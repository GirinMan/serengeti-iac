import logging
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from minio import Minio
from sqlalchemy import create_engine, text

from worker.config import settings

logger = logging.getLogger(__name__)

TARGET_STAGING = {
    "parcels": "staging.import_parcels",
    "buildings": "staging.import_buildings",
    "facilities": "staging.import_facilities",
}

# Column alias maps: staging column name alternatives → target column
# First match wins; if none found, NULL is used
COLUMN_ALIASES = {
    "parcels": {
        "pnu": ["pnu"],
        "jibun": ["jibun"],
        "jimok": ["jimok"],
        "area_m2": ["area_m2", "area", "shp_area"],
    },
    "buildings": {
        "bld_name": ["bld_name", "bldnm", "bdnm", "name", "nm"],
        "bld_use": ["bld_use", "blduse", "use", "usage"],
        "address": ["address", "addr", "juso"],
        "floors": ["floors", "floor", "grnd_flr", "flr_cnt"],
    },
    "facilities": {},
}


def _get_engine():
    return create_engine(settings.database_url)


def _get_minio() -> Minio:
    return Minio(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def _update_status(engine, import_id: int, status: str, error_msg: str | None = None, record_count: int | None = None):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE audit.data_imports
                SET status = :status, error_msg = :error_msg, record_count = :record_count,
                    completed_at = CASE WHEN :status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
                WHERE id = :id
            """),
            {"status": status, "error_msg": error_msg, "record_count": record_count, "id": import_id},
        )
        conn.commit()


def _download_from_minio(minio_path: str, work_dir: Path) -> Path:
    client = _get_minio()
    parts = minio_path.split("/", 1)
    bucket = parts[0]
    object_name = parts[1]
    filename = object_name.rsplit("/", 1)[-1]
    local_path = work_dir / filename
    client.fget_object(bucket, object_name, str(local_path))
    return local_path


def _extract_if_zip(file_path: Path, work_dir: Path) -> Path:
    if file_path.suffix.lower() == ".zip":
        extract_dir = work_dir / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(file_path) as zf:
            zf.extractall(extract_dir)
        shp_files = list(extract_dir.rglob("*.shp"))
        if shp_files:
            return shp_files[0]
        geojson_files = list(extract_dir.rglob("*.geojson")) + list(extract_dir.rglob("*.json"))
        if geojson_files:
            return geojson_files[0]
        gpkg_files = list(extract_dir.rglob("*.gpkg"))
        if gpkg_files:
            return gpkg_files[0]
        raise ValueError("No .shp, .geojson, or .gpkg found in zip archive")
    return file_path


def _detect_srid(file_path: Path) -> int:
    """Detect SRID from .prj file or ogrinfo fallback.

    Korean coordinate systems:
    - EPSG:5174 (Korean 1985 / Modified Central)
    - EPSG:5179 (Korea 2000 / Unified CS)
    - EPSG:5181 (Korea 2000 / Central Belt)
    - EPSG:5186 (Korea 2000 / Central Belt 2010)
    - EPSG:2097 (Korean 1985 / Central Belt)
    """
    prj_file = file_path.with_suffix(".prj")
    if prj_file.exists():
        prj_content = prj_file.read_text()

        # Korea 2000 variants (newer datum)
        if "Korea_2000" in prj_content:
            if "Central_Belt_2010" in prj_content:
                return 5186
            if "Unified" in prj_content:
                return 5179
            return 5181
        # Korean 1985 variants (older datum)
        if "Korean_1985" in prj_content:
            if "Modified" in prj_content:
                return 5174
            return 2097
        # Bessel 1841 (legacy Korean)
        if "Bessel_1841" in prj_content or "Bessel 1841" in prj_content:
            return 5174
        # WGS 84
        if "WGS_1984" in prj_content or "WGS 84" in prj_content:
            if "UTM" in prj_content and "52N" in prj_content:
                return 32652
            return 4326

    # Fallback: use ogrinfo to detect SRID
    try:
        result = subprocess.run(
            ["ogrinfo", "-al", "-so", str(file_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if "EPSG:" in line:
                    import re

                    match = re.search(r"EPSG:(\d+)", line)
                    if match:
                        return int(match.group(1))
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # Last resort: infer from coordinate range in the file
    inferred = _infer_srid_from_coords(file_path)
    if inferred:
        logger.info("Inferred SRID %d from coordinate range for %s", inferred, file_path)
        return inferred

    logger.warning("Could not detect SRID for %s, defaulting to 4326", file_path)
    return 4326


def _infer_srid_from_coords(file_path: Path) -> int | None:
    """Infer SRID from coordinate ranges using ogrinfo extent.

    Korean projected CRS coordinate ranges (approximate):
    - EPSG:5181/5174/2097: X 100,000~400,000, Y 100,000~600,000
    - EPSG:5186: X 100,000~600,000, Y 100,000~700,000
    - EPSG:5179: X 700,000~1,400,000, Y 1,300,000~2,700,000
    - EPSG:32652 (UTM): X 100,000~900,000, Y 3,500,000~4,500,000
    - WGS84: X 124~132, Y 33~43
    """
    try:
        result = subprocess.run(
            ["ogrinfo", "-al", "-so", "-geom=SUMMARY", str(file_path)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return None

        import re

        # Parse Extent: (min_x, min_y) - (max_x, max_y)
        match = re.search(
            r"Extent:\s*\(([\d.e+-]+),\s*([\d.e+-]+)\)\s*-\s*\(([\d.e+-]+),\s*([\d.e+-]+)\)", result.stdout
        )
        if not match:
            return None

        min_x, min_y = float(match.group(1)), float(match.group(2))
        max_x, max_y = float(match.group(3)), float(match.group(4))
        logger.info("File extent: (%.1f, %.1f) - (%.1f, %.1f)", min_x, min_y, max_x, max_y)

        # WGS84 range (longitude 124~132, latitude 33~43 for Korea)
        if 120 < min_x < 135 and 30 < min_y < 45:
            return 4326

        # Korea 2000 Central Belt (EPSG:5181) / Korean 1985 (EPSG:5174, 2097)
        # X: 100,000~400,000, Y: 100,000~600,000
        if 100_000 < min_x < 400_000 and 100_000 < min_y < 700_000:
            return 5181  # most common in Korean government data

        # Korea 2000 Central Belt 2010 (EPSG:5186)
        # Similar range but slightly different origin
        if 100_000 < min_x < 600_000 and 100_000 < min_y < 700_000:
            return 5186

        # Korea 2000 Unified (EPSG:5179)
        if 700_000 < min_x < 1_500_000 and 1_300_000 < min_y < 2_700_000:
            return 5179

        # UTM Zone 52N (EPSG:32652)
        if 100_000 < min_x < 900_000 and 3_500_000 < min_y < 4_500_000:
            return 32652

    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        pass

    return None


def _import_shapefile(engine, file_path: Path, staging_table: str, srid: int) -> int:
    with engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {staging_table} CASCADE;"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS staging;"))
        conn.commit()

    cmd_shp2pgsql = [
        "shp2pgsql",
        "-s",
        str(srid),
        "-W",
        "UTF-8",
        str(file_path),
        staging_table,
    ]
    cmd_psql = [
        "psql",
        settings.database_url,
        "-q",
    ]

    shp_proc = subprocess.Popen(cmd_shp2pgsql, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    psql_proc = subprocess.Popen(cmd_psql, stdin=shp_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    shp_proc.stdout.close()
    _, stderr = psql_proc.communicate()

    if psql_proc.returncode != 0:
        raise RuntimeError(f"shp2pgsql/psql failed: {stderr.decode()}")

    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT COUNT(*) FROM {staging_table};"))
        return result.scalar() or 0


def _import_geojson(engine, file_path: Path, staging_table: str, srid: int) -> int:
    """Import GeoJSON/JSON file into a staging table using Python + SQL."""
    import json as _json

    with open(file_path) as f:
        data = _json.load(f)

    features = data.get("features", [])
    if not features:
        raise ValueError("GeoJSON contains no features")

    # Collect all property keys across features
    prop_keys: set[str] = set()
    for feat in features:
        props = feat.get("properties") or {}
        prop_keys.update(props.keys())
    prop_keys.discard("geom")
    prop_keys.discard("gid")
    sorted_keys = sorted(prop_keys)

    with engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {staging_table} CASCADE;"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS staging;"))

        # Create staging table with gid, geom, and property columns (all text)
        col_defs = ", ".join(f'"{k}" TEXT' for k in sorted_keys)
        extra = f", {col_defs}" if col_defs else ""
        conn.execute(
            text(f"""
            CREATE TABLE {staging_table} (
                gid SERIAL PRIMARY KEY,
                geom geometry{extra}
            );
        """)
        )

        # Insert features
        for feat in features:
            geom_json = _json.dumps(feat["geometry"])
            props = feat.get("properties") or {}
            col_names = ", ".join(f'"{k}"' for k in sorted_keys)
            placeholders = ", ".join(f":prop_{i}" for i in range(len(sorted_keys)))
            params = {
                f"prop_{i}": str(props.get(k, "")) if props.get(k) is not None else None
                for i, k in enumerate(sorted_keys)
            }
            params["geom_json"] = geom_json

            if sorted_keys:
                conn.execute(
                    text(
                        f"INSERT INTO {staging_table} (geom, {col_names}) VALUES (ST_GeomFromGeoJSON(:geom_json), {placeholders})"
                    ),
                    params,
                )
            else:
                conn.execute(
                    text(f"INSERT INTO {staging_table} (geom) VALUES (ST_GeomFromGeoJSON(:geom_json))"),
                    params,
                )

        conn.commit()
        count_result = conn.execute(text(f"SELECT COUNT(*) FROM {staging_table};"))
        return count_result.scalar() or 0


def _import_gpkg(engine, file_path: Path, staging_table: str, srid: int) -> int:
    """Import GPKG file using ogr2ogr to dump SQL, then load via psql.

    ogr2ogr converts GPKG → PostgreSQL dump SQL which is piped to psql.
    """
    schema, table = staging_table.split(".", 1)

    with engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {staging_table} CASCADE;"))
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema};"))
        conn.commit()

    # First, list layers in the GPKG to get the layer name
    list_result = subprocess.run(
        ["ogrinfo", "-q", str(file_path)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    layer_name = None
    if list_result.returncode == 0:
        for line in list_result.stdout.splitlines():
            line = line.strip()
            if line and ":" in line:
                # Format: "1: layer_name (type)"
                parts = line.split(":", 1)
                if len(parts) == 2:
                    layer_name = parts[1].strip().split(" ")[0]
                    break

    if not layer_name:
        raise ValueError(f"Could not find any layer in GPKG: {file_path}")

    logger.info("GPKG layer: %s", layer_name)

    # ogr2ogr -f PGDUMP to generate SQL
    cmd = [
        "ogr2ogr",
        "-f",
        "PGDUMP",
        "/vsistdout/",
        str(file_path),
        layer_name,
        "-nln",
        f"{schema}.{table}",
        "-lco",
        "CREATE_SCHEMA=OFF",
        "-lco",
        f"SRID={srid}",
        "-lco",
        "GEOMETRY_NAME=geom",
        "-nlt",
        "PROMOTE_TO_MULTI",
        "--config",
        "PG_USE_COPY",
        "YES",
    ]
    cmd_psql = ["psql", settings.database_url, "-q"]

    ogr_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    psql_proc = subprocess.Popen(cmd_psql, stdin=ogr_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    ogr_proc.stdout.close()
    _, stderr = psql_proc.communicate(timeout=300)

    if psql_proc.returncode != 0:
        ogr_stderr = ogr_proc.stderr.read().decode() if ogr_proc.stderr else ""
        raise RuntimeError(f"ogr2ogr/psql failed: {stderr.decode()} | ogr2ogr: {ogr_stderr}")

    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT COUNT(*) FROM {staging_table};"))
        return result.scalar() or 0


def _get_staging_columns(engine, staging_table: str) -> set[str]:
    """Get column names of a staging table."""
    with engine.connect() as conn:
        result = conn.execute(
            text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema || '.' || table_name = :tbl
        """),
            {"tbl": staging_table},
        )
        return {row[0] for row in result}


def _resolve_col(
    target_col: str, staging_cols: set[str], aliases: dict[str, list[str]], cast: str = ""
) -> tuple[str, str | None]:
    """Resolve a target column to a staging column using aliases.

    Returns (sql_expression, matched_staging_col_or_None).
    """
    candidates = aliases.get(target_col, [target_col])
    for candidate in candidates:
        if candidate in staging_cols:
            if cast:
                return f"NULLIF(s.\"{candidate}\", ''){cast}", candidate
            return f's."{candidate}"', candidate
    return "NULL", None


def _build_properties_exclusion(matched_cols: list[str]) -> str:
    """Build to_jsonb exclusion list for columns already mapped."""
    excludes = ["'geom'", "'gid'"]
    for col in matched_cols:
        if col:
            excludes.append(f"'{col}'")
    return " - ".join(["to_jsonb(s)"] + excludes)


def _transform_staging(
    engine, target_table: str, staging_table: str, srid: int, region_code: str, facility_type: str = ""
) -> int:
    staging_cols = _get_staging_columns(engine, staging_table)
    logger.info("Staging columns for %s: %s", staging_table, staging_cols)

    aliases = COLUMN_ALIASES.get(target_table, {})
    geom_expr = f"ST_Transform(ST_SetSRID(s.geom, {srid}), 4326)"

    if target_table == "parcels":
        pnu, pnu_col = _resolve_col("pnu", staging_cols, aliases)
        jibun, jibun_col = _resolve_col("jibun", staging_cols, aliases)
        jimok, jimok_col = _resolve_col("jimok", staging_cols, aliases)
        area, area_col = _resolve_col("area_m2", staging_cols, aliases, cast="::numeric(12,2)")
        props = _build_properties_exclusion([pnu_col, jibun_col, jimok_col, area_col])
        sql = f"""
            INSERT INTO gis.parcels (region_id, pnu, jibun, jimok, area_m2, geom, properties)
            SELECT r.id, {pnu}, {jibun}, {jimok}, {area},
                   ST_Multi({geom_expr}), {props}
            FROM {staging_table} s
            CROSS JOIN gis.regions r WHERE r.code = :region_code
            ON CONFLICT DO NOTHING;
        """
    elif target_table == "buildings":
        bname, bname_col = _resolve_col("bld_name", staging_cols, aliases)
        buse, buse_col = _resolve_col("bld_use", staging_cols, aliases)
        addr, addr_col = _resolve_col("address", staging_cols, aliases)
        flr, flr_col = _resolve_col("floors", staging_cols, aliases, cast="::smallint")
        if addr_col:
            addr = f"COALESCE({addr}, '')"
        props = _build_properties_exclusion([bname_col, buse_col, addr_col, flr_col])
        sql = f"""
            INSERT INTO gis.buildings (region_id, bld_name, bld_use, address, floors, geom, properties)
            SELECT r.id, {bname}, {buse}, {addr}, {flr},
                   {geom_expr}, {props}
            FROM {staging_table} s
            CROSS JOIN gis.regions r WHERE r.code = :region_code
            ON CONFLICT DO NOTHING;
        """
    elif target_table == "facilities":
        props = _build_properties_exclusion([])
        sql = f"""
            INSERT INTO gis.facilities (region_id, type_id, geom, properties)
            SELECT r.id, ft.id, {geom_expr}, {props}
            FROM {staging_table} s
            CROSS JOIN gis.regions r
            CROSS JOIN gis.facility_types ft
            WHERE r.code = :region_code AND ft.code = :facility_type
            ON CONFLICT DO NOTHING;
        """
    else:
        raise ValueError(f"No transform SQL for target: {target_table}")

    logger.info("Transform SQL: %s", sql.strip()[:200])

    with engine.connect() as conn:
        result = conn.execute(text(sql), {"region_code": region_code, "facility_type": facility_type})
        conn.commit()
        return result.rowcount or 0


async def process_import(event: dict) -> None:
    import_id = event["import_id"]
    minio_path = event["minio_path"]
    target_table = event["target_table"]
    region_code = event.get("region_code", "")
    facility_type = event.get("facility_type", "")

    engine = _get_engine()
    work_dir = Path(tempfile.mkdtemp(dir=settings.work_dir))

    try:
        _update_status(engine, import_id, "processing")

        logger.info("[%d] Downloading from MinIO: %s", import_id, minio_path)
        local_file = _download_from_minio(minio_path, work_dir)

        data_file = _extract_if_zip(local_file, work_dir)
        logger.info("[%d] Data file: %s", import_id, data_file)

        srid = _detect_srid(data_file)
        logger.info("[%d] Detected SRID: %d", import_id, srid)

        staging_table = TARGET_STAGING.get(target_table)
        if not staging_table:
            raise ValueError(f"Unknown target table: {target_table}")

        suffix = data_file.suffix.lower()
        if suffix == ".shp":
            record_count = _import_shapefile(engine, data_file, staging_table, srid)
        elif suffix in (".geojson", ".json"):
            record_count = _import_geojson(engine, data_file, staging_table, srid)
        elif suffix == ".gpkg":
            record_count = _import_gpkg(engine, data_file, staging_table, srid)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        logger.info("[%d] Imported %d records to %s", import_id, record_count, staging_table)

        transformed = _transform_staging(engine, target_table, staging_table, srid, region_code, facility_type)
        logger.info("[%d] Transformed %d records to gis.%s", import_id, transformed, target_table)

        with engine.connect() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS {staging_table} CASCADE;"))
            conn.commit()

        _update_status(engine, import_id, "completed", record_count=transformed)
        logger.info("[%d] Import completed successfully", import_id)

    except Exception as e:
        logger.exception("[%d] Import failed", import_id)
        _update_status(engine, import_id, "failed", error_msg=str(e))

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        engine.dispose()

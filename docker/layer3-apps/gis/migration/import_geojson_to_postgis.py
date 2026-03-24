#!/usr/bin/env python3
"""
Import pocheon_facilities.geojson directly into gis.facilities via psycopg2.
Replaces ogr2ogr-based import when ogr2ogr is unavailable.
"""

import json
import os
import sys

import psycopg2
from psycopg2.extras import execute_values

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GEOJSON_PATH = os.path.join(SCRIPT_DIR, "pocheon_facilities.geojson")

DB_HOST = os.environ.get("PGHOST", "postgres")
DB_PORT = os.environ.get("PGPORT", "5432")
DB_NAME = os.environ.get("PGDATABASE", "gisdb")
DB_USER = os.environ.get("PGUSER", "postgres")
DB_PASS = os.environ["PGPASSWORD"]  # Required: set via environment variable

REGION_ID = 1  # POCHEON

LAYER_CD_MAP = {
    "NMH": "MANHOLE_SEW",
    "NAR": "MANHOLE_RAIN",
    "NBR": "INLET_RAIN",
    "NBS": "MANHOLE_SUB", "NSH": "MANHOLE_SUB",
    "NMS": "MANHOLE_SUB", "NMR": "MANHOLE_SUB", "NRS": "MANHOLE_SUB",
    "NVN": "VALVE",
    "NVR": "VALVE_SUB", "NVM": "VALVE_SUB", "NVS": "VALVE_SUB",
    "NGT": "GATE",
    "NWE": "WELL",
    "FPP": "PUMP",
    "FFA": "FACILITY_OTHER", "FAR": "FACILITY_OTHER",
    "PBU": "PIPE_SEW", "PHW": "PIPE_SEW",
    "PBS": "PIPE_RAIN",
    "PCP": "PIPE_COMBINED",
    "PPN": "PIPE_PLAN",
    "PTR": "PIPE_TREATMENT", "PTS": "PIPE_TREATMENT",
}
DEFAULT_TYPE = "PIPE_OTHER"

# Properties to include in the JSONB column
PROPS_KEYS = [
    "GUID", "LAYER_CD", "SYM_KEY", "SYM_ANG", "LEVEL",
    # pipe
    "KW_MA", "KW_DI", "KW_LENG", "KW_SL",
    "KW_HI_1", "KW_HI_2", "KW_HI_3", "KW_HI_4",
    "BOM_FSN", "EOM_FSN", "FW_FSN", "DO_NUM", "MAKESW",
    # manhole
    "MH_MA", "MH_SIZ", "MH_HEP", "MH_INV",
    "MH_CDN", "MH_CLF", "MH_LEVEL", "MH_ZONE",
    "CVR_CDN", "CVR_SIZ", "CVR_STD", "OLD_ID",
]


def geojson_to_wkt(geometry):
    """Convert GeoJSON geometry dict to WKT string."""
    gtype = geometry["type"]
    coords = geometry["coordinates"]

    if gtype == "Point":
        return f"POINT({coords[0]} {coords[1]})"
    elif gtype == "LineString":
        pts = ", ".join(f"{c[0]} {c[1]}" for c in coords)
        return f"LINESTRING({pts})"
    elif gtype == "MultiLineString":
        lines = ", ".join(
            "(" + ", ".join(f"{c[0]} {c[1]}" for c in line) + ")"
            for line in coords
        )
        return f"MULTILINESTRING({lines})"
    elif gtype == "Polygon":
        rings = ", ".join(
            "(" + ", ".join(f"{c[0]} {c[1]}" for c in ring) + ")"
            for ring in coords
        )
        return f"POLYGON({rings})"
    else:
        raise ValueError(f"Unsupported geometry type: {gtype}")


def extract_year(props):
    """Extract year from KW_YMD or MH_YMD."""
    for key in ("KW_YMD", "MH_YMD"):
        val = props.get(key)
        if val and val != "null" and len(str(val)) >= 4:
            try:
                return int(str(val)[:4])
            except (ValueError, TypeError):
                pass
    return None


def build_properties_jsonb(props):
    """Build clean properties dict, removing null/empty values."""
    result = {}
    for key in PROPS_KEYS:
        val = props.get(key)
        if val is not None and val != "null" and val != "":
            result[key] = val
    return json.dumps(result)


def main():
    print(f"Loading GeoJSON from {GEOJSON_PATH}...")
    with open(GEOJSON_PATH, "r") as f:
        data = json.load(f)

    features = data["features"]
    total = len(features)
    print(f"  {total} features loaded.")

    print(f"Connecting to {DB_NAME}@{DB_HOST}:{DB_PORT}...")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS,
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Load facility_types mapping
    cur.execute("SELECT code, id FROM gis.facility_types")
    type_map = dict(cur.fetchall())
    print(f"  {len(type_map)} facility types loaded.")

    # Clear existing Pocheon facilities
    cur.execute("DELETE FROM gis.facilities WHERE region_id = %s", (REGION_ID,))
    deleted = cur.rowcount
    if deleted:
        print(f"  Cleared {deleted} existing Pocheon facilities.")

    # Prepare batch insert
    BATCH_SIZE = 5000
    inserted = 0
    skipped = 0
    errors = 0

    sql = """
        INSERT INTO gis.facilities (region_id, type_id, fac_id, geom, properties, year)
        VALUES %s
    """
    template = f"({REGION_ID}, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326), %s::jsonb, %s)"

    batch = []
    for i, feat in enumerate(features):
        props = feat.get("properties", {})
        geometry = feat.get("geometry")

        if not geometry:
            skipped += 1
            continue

        layer_cd = props.get("LAYER_CD", "")
        type_code = LAYER_CD_MAP.get(layer_cd, DEFAULT_TYPE)
        type_id = type_map.get(type_code)

        if not type_id:
            skipped += 1
            continue

        try:
            wkt = geojson_to_wkt(geometry)
        except (ValueError, KeyError, IndexError) as e:
            errors += 1
            continue

        fac_id = props.get("FSN")
        year = extract_year(props)
        props_json = build_properties_jsonb(props)

        batch.append((type_id, fac_id, wkt, props_json, year))

        if len(batch) >= BATCH_SIZE:
            execute_values(cur, sql, batch, template=template)
            inserted += len(batch)
            batch = []
            pct = (i + 1) / total * 100
            print(f"  {inserted:,} inserted ({pct:.1f}%)...", end="\r")

    # Final batch
    if batch:
        execute_values(cur, sql, batch, template=template)
        inserted += len(batch)

    conn.commit()
    print(f"\n  Import complete: {inserted:,} inserted, {skipped} skipped, {errors} errors")

    # Summary
    cur.execute("""
        SELECT ft.code, ft.name, count(f.id) AS cnt
        FROM gis.facilities f
        JOIN gis.facility_types ft ON f.type_id = ft.id
        WHERE f.region_id = %s
        GROUP BY ft.code, ft.name
        ORDER BY cnt DESC
    """, (REGION_ID,))

    print("\n=== Import Summary by Type ===")
    for code, name, cnt in cur.fetchall():
        print(f"  {code:<18} {name:<10} {cnt:>8,}")

    cur.execute("SELECT count(*) FROM gis.facilities WHERE region_id = %s", (REGION_ID,))
    print(f"\n  TOTAL: {cur.fetchone()[0]:,}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

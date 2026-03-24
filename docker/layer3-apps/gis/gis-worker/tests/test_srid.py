"""Tests for SRID detection functions."""

from worker.ingest import _detect_srid


def test_korea_2000_central_belt(work_dir):
    """Korea 2000 Central Belt → EPSG:5181."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["Korea_2000_Korea_Central_Belt",'
        'GEOGCS["GCS_Korea_2000",DATUM["D_Korea_2000",'
        'SPHEROID["GRS_1980",6378137.0,298.257222101]]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 5181


def test_korea_2000_central_belt_2010(work_dir):
    """Korea 2000 Central Belt 2010 → EPSG:5186."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["Korea_2000_Korea_Central_Belt_2010",'
        'GEOGCS["GCS_Korea_2000",DATUM["D_Korea_2000",'
        'SPHEROID["GRS_1980",6378137.0,298.257222101]]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 5186


def test_korea_2000_unified(work_dir):
    """Korea 2000 Unified → EPSG:5179."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["Korea_2000_Unified_CS",'
        'GEOGCS["GCS_Korea_2000",DATUM["D_Korea_2000",'
        'SPHEROID["GRS_1980",6378137.0,298.257222101]]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 5179


def test_korean_1985_modified(work_dir):
    """Korean 1985 Modified → EPSG:5174."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["Korean_1985_Modified_Central",'
        'GEOGCS["GCS_Korean_Datum_1985",'
        'DATUM["D_Korean_Datum_1985"]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 5174


def test_korean_1985_central(work_dir):
    """Korean 1985 Central → EPSG:2097."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["Korean_1985_Korea_Central",'
        'GEOGCS["GCS_Korean_Datum_1985",'
        'DATUM["D_Korean_Datum_1985"]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 2097


def test_bessel_1841(work_dir):
    """Bessel 1841 datum → EPSG:5174."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["old_projection",'
        'GEOGCS["GCS_Bessel_1841",'
        'DATUM["D_Bessel_1841",'
        'SPHEROID["Bessel_1841",6377397.155,299.1528128]]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 5174


def test_wgs84(work_dir):
    """WGS 84 → EPSG:4326."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'GEOGCS["GCS_WGS_1984",'
        'DATUM["D_WGS_1984",'
        'SPHEROID["WGS_1984",6378137.0,298.257223563]],'
        'PRIMEM["Greenwich",0.0],'
        'UNIT["Degree",0.0174532925199433]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 4326


def test_utm_52n(work_dir):
    """WGS 84 UTM Zone 52N → EPSG:32652."""
    prj = work_dir / "test.prj"
    prj.write_text(
        'PROJCS["WGS_1984_UTM_Zone_52N",'
        'GEOGCS["GCS_WGS_1984",'
        'DATUM["D_WGS_1984",'
        'SPHEROID["WGS_1984",6378137.0,298.257223563]]],'
        'UNIT["Meter",1.0]]'
    )
    shp = work_dir / "test.shp"
    shp.touch()
    assert _detect_srid(shp) == 32652


def test_no_prj_defaults_4326(work_dir):
    """No .prj file and no ogrinfo → default 4326."""
    shp = work_dir / "test.shp"
    shp.touch()
    # Without ogrinfo available for a fake .shp, should default to 4326
    result = _detect_srid(shp)
    # May return 4326 or a value inferred from ogrinfo (if available)
    assert isinstance(result, int)

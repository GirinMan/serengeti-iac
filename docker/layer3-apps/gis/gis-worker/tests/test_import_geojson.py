"""Integration tests for GeoJSON import pipeline (requires DB)."""

import json

import pytest
from sqlalchemy import text

from worker.ingest import _get_staging_columns, _import_geojson

STAGING_TABLE = "staging.test_import"


@pytest.fixture(autouse=True)
def cleanup_staging(db_engine):
    """Ensure staging table is cleaned up before and after each test."""
    with db_engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {STAGING_TABLE} CASCADE;"))
        conn.commit()
    yield
    with db_engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {STAGING_TABLE} CASCADE;"))
        conn.commit()


class TestImportGeojson:
    def test_basic_import(self, db_engine, sample_geojson):
        """Import a basic GeoJSON file into staging."""
        count = _import_geojson(db_engine, sample_geojson, STAGING_TABLE, 4326)
        assert count == 2

    def test_staging_columns(self, db_engine, sample_geojson):
        """Staging table has correct columns."""
        _import_geojson(db_engine, sample_geojson, STAGING_TABLE, 4326)
        cols = _get_staging_columns(db_engine, STAGING_TABLE)
        assert "geom" in cols
        assert "gid" in cols
        assert "name" in cols
        assert "value" in cols

    def test_geometry_stored(self, db_engine, sample_geojson):
        """Geometry is correctly stored as PostGIS geometry."""
        _import_geojson(db_engine, sample_geojson, STAGING_TABLE, 4326)
        with db_engine.connect() as conn:
            result = conn.execute(text(f"SELECT ST_X(geom), ST_Y(geom) FROM {STAGING_TABLE} ORDER BY gid LIMIT 1"))
            row = result.fetchone()
            assert abs(row[0] - 127.2) < 0.001
            assert abs(row[1] - 37.9) < 0.001

    def test_properties_stored(self, db_engine, sample_geojson):
        """Properties are stored as text columns."""
        _import_geojson(db_engine, sample_geojson, STAGING_TABLE, 4326)
        with db_engine.connect() as conn:
            result = conn.execute(text(f'SELECT "name", "value" FROM {STAGING_TABLE} ORDER BY gid LIMIT 1'))
            row = result.fetchone()
            assert row[0] == "Test Point 1"
            assert row[1] == "100"

    def test_empty_features_raises(self, db_engine, work_dir):
        """GeoJSON with no features raises ValueError."""
        data = {"type": "FeatureCollection", "features": []}
        path = work_dir / "empty.geojson"
        path.write_text(json.dumps(data))
        with pytest.raises(ValueError, match="no features"):
            _import_geojson(db_engine, path, STAGING_TABLE, 4326)

    def test_geojson_no_properties(self, db_engine, work_dir):
        """GeoJSON features with null properties still import."""
        data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [127.2, 37.9]},
                    "properties": None,
                }
            ],
        }
        path = work_dir / "noprops.geojson"
        path.write_text(json.dumps(data))
        count = _import_geojson(db_engine, path, STAGING_TABLE, 4326)
        assert count == 1

"""Integration tests for staging → target transform (requires DB)."""

import json

import pytest
from sqlalchemy import text

from worker.ingest import _import_geojson, _transform_staging

STAGING_TABLE = "staging.test_transform"


@pytest.fixture(autouse=True)
def cleanup(db_engine):
    """Clean staging and any test data before/after."""
    with db_engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {STAGING_TABLE} CASCADE;"))
        conn.execute(text("DELETE FROM gis.facilities WHERE properties->>'test_marker' = 'loop17';"))
        conn.commit()
    yield
    with db_engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {STAGING_TABLE} CASCADE;"))
        conn.execute(text("DELETE FROM gis.facilities WHERE properties->>'test_marker' = 'loop17';"))
        conn.commit()


@pytest.fixture
def facilities_geojson(work_dir):
    """GeoJSON with facilities test data."""
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [127.2, 37.9]},
                "properties": {"test_marker": "loop17", "depth": "1.5"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [127.21, 37.91]},
                "properties": {"test_marker": "loop17", "depth": "2.0"},
            },
        ],
    }
    path = work_dir / "facilities.geojson"
    path.write_text(json.dumps(data))
    return path


def _get_region_code(db_engine) -> str:
    """Get the first region code from DB."""
    with db_engine.connect() as conn:
        result = conn.execute(text("SELECT code FROM gis.regions LIMIT 1"))
        row = result.fetchone()
        if not row:
            pytest.skip("No regions in DB")
        return row[0]


def _get_facility_type_code(db_engine) -> str:
    """Get the first facility type code from DB."""
    with db_engine.connect() as conn:
        result = conn.execute(text("SELECT code FROM gis.facility_types LIMIT 1"))
        row = result.fetchone()
        if not row:
            pytest.skip("No facility_types in DB")
        return row[0]


class TestTransformStaging:
    def test_facilities_transform(self, db_engine, facilities_geojson):
        """Import GeoJSON → staging → gis.facilities transform."""
        region_code = _get_region_code(db_engine)
        ftype_code = _get_facility_type_code(db_engine)

        record_count = _import_geojson(db_engine, facilities_geojson, STAGING_TABLE, 4326)
        assert record_count == 2

        transformed = _transform_staging(db_engine, "facilities", STAGING_TABLE, 4326, region_code, ftype_code)
        assert transformed == 2

        # Verify data in gis.facilities
        with db_engine.connect() as conn:
            result = conn.execute(
                text("SELECT COUNT(*) FROM gis.facilities WHERE properties->>'test_marker' = 'loop17'")
            )
            assert result.scalar() == 2

    def test_transform_preserves_geometry(self, db_engine, facilities_geojson):
        """Transformed geometry is in WGS84 (SRID 4326)."""
        region_code = _get_region_code(db_engine)
        ftype_code = _get_facility_type_code(db_engine)

        _import_geojson(db_engine, facilities_geojson, STAGING_TABLE, 4326)
        _transform_staging(db_engine, "facilities", STAGING_TABLE, 4326, region_code, ftype_code)

        with db_engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT ST_SRID(geom), ST_X(geom), ST_Y(geom) "
                    "FROM gis.facilities WHERE properties->>'test_marker' = 'loop17' "
                    "ORDER BY id LIMIT 1"
                )
            )
            row = result.fetchone()
            assert row[0] == 4326
            assert abs(row[1] - 127.2) < 0.01
            assert abs(row[2] - 37.9) < 0.01

    def test_unknown_target_raises(self, db_engine):
        """Unknown target table raises ValueError."""
        with pytest.raises(ValueError, match="No transform SQL"):
            _transform_staging(db_engine, "unknown_table", STAGING_TABLE, 4326, "CODE")

    def test_properties_in_jsonb(self, db_engine, facilities_geojson):
        """Extra properties are stored in jsonb column."""
        region_code = _get_region_code(db_engine)
        ftype_code = _get_facility_type_code(db_engine)

        _import_geojson(db_engine, facilities_geojson, STAGING_TABLE, 4326)
        _transform_staging(db_engine, "facilities", STAGING_TABLE, 4326, region_code, ftype_code)

        with db_engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT properties->>'depth' FROM gis.facilities "
                    "WHERE properties->>'test_marker' = 'loop17' ORDER BY id LIMIT 1"
                )
            )
            row = result.fetchone()
            assert row[0] == "1.5"

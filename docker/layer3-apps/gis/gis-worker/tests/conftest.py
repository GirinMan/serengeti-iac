import shutil
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine

from worker.config import settings


@pytest.fixture(scope="session")
def db_engine():
    """Session-scoped DB engine for integration tests."""
    engine = create_engine(settings.database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def work_dir():
    """Temporary working directory, cleaned up after test."""
    d = Path(tempfile.mkdtemp())
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def sample_geojson(work_dir):
    """Create a minimal GeoJSON file for testing."""
    import json

    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [127.2, 37.9]},
                "properties": {"name": "Test Point 1", "value": "100"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [127.21, 37.91]},
                "properties": {"name": "Test Point 2", "value": "200"},
            },
        ],
    }
    path = work_dir / "test.geojson"
    path.write_text(json.dumps(data))
    return path


@pytest.fixture
def sample_prj_korea2000(work_dir):
    """Create a .prj file with Korea 2000 Central Belt CRS."""
    prj_content = (
        'PROJCS["Korea_2000_Korea_Central_Belt",'
        'GEOGCS["GCS_Korea_2000",'
        'DATUM["D_Korea_2000",'
        'SPHEROID["GRS_1980",6378137.0,298.257222101]],'
        'PRIMEM["Greenwich",0.0],'
        'UNIT["Degree",0.0174532925199433]],'
        'PROJECTION["Transverse_Mercator"],'
        'PARAMETER["False_Easting",200000.0],'
        'PARAMETER["False_Northing",500000.0],'
        'PARAMETER["Central_Meridian",127.0],'
        'PARAMETER["Scale_Factor",1.0],'
        'PARAMETER["Latitude_Of_Origin",38.0],'
        'UNIT["Meter",1.0]]'
    )
    shp_path = work_dir / "test.shp"
    shp_path.touch()
    prj_path = work_dir / "test.prj"
    prj_path.write_text(prj_content)
    return shp_path

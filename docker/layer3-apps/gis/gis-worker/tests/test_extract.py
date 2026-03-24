"""Tests for _extract_if_zip function."""

import json
import zipfile

import pytest

from worker.ingest import _extract_if_zip


def test_non_zip_returns_same_path(work_dir):
    """Non-zip files are returned as-is."""
    file_path = work_dir / "test.geojson"
    file_path.write_text("{}")
    result = _extract_if_zip(file_path, work_dir)
    assert result == file_path


def test_zip_with_shp(work_dir):
    """ZIP containing .shp returns the .shp path."""
    zip_path = work_dir / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("data/test.shp", b"fake shp")
        zf.writestr("data/test.dbf", b"fake dbf")
        zf.writestr("data/test.shx", b"fake shx")
    result = _extract_if_zip(zip_path, work_dir)
    assert result.suffix == ".shp"
    assert result.name == "test.shp"


def test_zip_with_geojson(work_dir):
    """ZIP containing .geojson returns the .geojson path."""
    geojson_data = json.dumps({"type": "FeatureCollection", "features": []})
    zip_path = work_dir / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("data.geojson", geojson_data)
    result = _extract_if_zip(zip_path, work_dir)
    assert result.suffix == ".geojson"


def test_zip_with_gpkg(work_dir):
    """ZIP containing .gpkg returns the .gpkg path."""
    zip_path = work_dir / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("layers.gpkg", b"fake gpkg")
    result = _extract_if_zip(zip_path, work_dir)
    assert result.suffix == ".gpkg"


def test_zip_shp_priority_over_geojson(work_dir):
    """SHP takes priority over GeoJSON in ZIP."""
    zip_path = work_dir / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("data.shp", b"fake shp")
        zf.writestr("data.geojson", b"{}")
    result = _extract_if_zip(zip_path, work_dir)
    assert result.suffix == ".shp"


def test_zip_no_spatial_file_raises(work_dir):
    """ZIP without spatial files raises ValueError."""
    zip_path = work_dir / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("readme.txt", "hello")
    with pytest.raises(ValueError, match="No .shp"):
        _extract_if_zip(zip_path, work_dir)

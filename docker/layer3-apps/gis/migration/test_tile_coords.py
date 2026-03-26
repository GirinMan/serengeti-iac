"""Tests for MVT tile coordinate -> WGS84 conversion.

Verifies that tile_coord_to_lnglat correctly preserves Y-axis orientation:
- Points at the top (north) of a tile must produce higher latitude
- Points at the bottom (south) of a tile must produce lower latitude
"""

import math

EXTENT = 4096
# z15 tile covering part of Pocheon area (approx 127.2E, 37.9N)
Z, TX, TY = 15, 27878, 12672


def tile_coord_to_lnglat(z, tx, ty, px, py, extent=EXTENT):
    """Copy of the function from extract_mvt_facilities.py for isolated testing.

    Assumes y_coord_down=True (MVT spec convention): py=0 is the top (north)
    of the tile, py=extent is the bottom (south).
    """
    world_x = tx + px / extent
    world_y = ty + py / extent
    n = 2.0 ** z
    lng = world_x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * world_y / n)))
    lat = math.degrees(lat_rad)
    return lng, lat


def test_top_of_tile_has_higher_latitude():
    """py=0 (top of tile, y_coord_down=True) -> higher latitude (north)."""
    _, lat_top = tile_coord_to_lnglat(Z, TX, TY, 0, 0, EXTENT)
    _, lat_bottom = tile_coord_to_lnglat(Z, TX, TY, 0, EXTENT, EXTENT)
    assert lat_top > lat_bottom, (
        f"Top of tile should be further north: lat_top={lat_top}, lat_bottom={lat_bottom}"
    )


def test_left_of_tile_has_lower_longitude():
    """px=0 (left of tile) -> lower longitude (west)."""
    lng_left, _ = tile_coord_to_lnglat(Z, TX, TY, 0, 0, EXTENT)
    lng_right, _ = tile_coord_to_lnglat(Z, TX, TY, EXTENT, 0, EXTENT)
    assert lng_left < lng_right, (
        f"Left of tile should be further west: lng_left={lng_left}, lng_right={lng_right}"
    )


def test_tile_corners_within_expected_range():
    """Tile corners should fall within Korean peninsula bounds."""
    for px, py in [(0, 0), (EXTENT, 0), (0, EXTENT), (EXTENT, EXTENT)]:
        lng, lat = tile_coord_to_lnglat(Z, TX, TY, px, py, EXTENT)
        assert 124 < lng < 132, f"Longitude {lng} out of Korea range"
        assert 33 < lat < 43, f"Latitude {lat} out of Korea range"


def test_y_ordering_preserved_within_tile():
    """Two points with different Y within a tile: lower py -> higher lat."""
    _, lat_north = tile_coord_to_lnglat(Z, TX, TY, 2048, 100, EXTENT)
    _, lat_south = tile_coord_to_lnglat(Z, TX, TY, 2048, 3900, EXTENT)
    assert lat_north > lat_south, (
        f"Northern point should have higher lat: {lat_north} vs {lat_south}"
    )


def test_adjacent_tiles_continuous():
    """Bottom of tile ty should match top of tile ty+1 (continuity)."""
    _, lat_bottom_tile = tile_coord_to_lnglat(Z, TX, TY, 2048, EXTENT, EXTENT)
    _, lat_top_next_tile = tile_coord_to_lnglat(Z, TX, TY + 1, 2048, 0, EXTENT)
    assert abs(lat_bottom_tile - lat_top_next_tile) < 1e-9, (
        f"Tile boundary discontinuity: {lat_bottom_tile} vs {lat_top_next_tile}"
    )


if __name__ == "__main__":
    test_top_of_tile_has_higher_latitude()
    test_left_of_tile_has_lower_longitude()
    test_tile_corners_within_expected_range()
    test_y_ordering_preserved_within_tile()
    test_adjacent_tiles_continuous()
    print("All tests passed.")

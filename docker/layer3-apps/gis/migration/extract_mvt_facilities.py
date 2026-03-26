#!/usr/bin/env python3
"""
MVT Tile → GeoJSON Extraction Script for Pocheon Facility Data

Reads z15 MVT tiles from the legacy system, converts tile-local coordinates
to EPSG:4326, deduplicates by GUID, and outputs a GeoJSON FeatureCollection.
"""

import json
import math
import os
import sys
from pathlib import Path

import mapbox_vector_tile
from shapely.geometry import mapping, shape


# --- Configuration ---

TILE_DIR = Path(__file__).resolve().parent.parent.parent / "origin" / "pocheon" / "node.pc" / "webapp" / "contents" / "facility"
ZOOM_LEVEL = 15
EXTENT = 4096
OUTPUT_DIR = Path(__file__).resolve().parent


# --- Coordinate conversion ---

def tile_coord_to_lnglat(z, tx, ty, px, py, extent=EXTENT):
    """Convert MVT tile pixel coordinates to lng/lat (EPSG:4326).

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


def convert_coordinates(coords, z, tx, ty):
    """Recursively convert coordinate arrays from tile coords to WGS84."""
    if isinstance(coords[0], (int, float)):
        # Single coordinate pair
        return list(tile_coord_to_lnglat(z, tx, ty, coords[0], coords[1]))
    return [convert_coordinates(c, z, tx, ty) for c in coords]


def convert_geometry(geom, z, tx, ty):
    """Convert a geometry dict from tile coordinates to WGS84."""
    geom_type = geom["type"]
    coords = geom["coordinates"]

    if geom_type == "Point":
        converted = tile_coord_to_lnglat(z, tx, ty, coords[0], coords[1])
        return {"type": "Point", "coordinates": list(converted)}
    elif geom_type in ("LineString", "MultiPoint"):
        return {"type": geom_type, "coordinates": convert_coordinates(coords, z, tx, ty)}
    elif geom_type in ("Polygon", "MultiLineString"):
        return {"type": geom_type, "coordinates": convert_coordinates(coords, z, tx, ty)}
    elif geom_type == "MultiPolygon":
        return {"type": geom_type, "coordinates": convert_coordinates(coords, z, tx, ty)}
    else:
        return {"type": geom_type, "coordinates": convert_coordinates(coords, z, tx, ty)}


def clean_properties(props):
    """Clean 'null' string values to None."""
    cleaned = {}
    for k, v in props.items():
        if v == "null" or v == "":
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned


def extract_tiles(tile_dir, zoom):
    """Walk z15 tiles and extract all features, deduplicated by GUID."""
    features = {}  # GUID -> feature
    z_dir = tile_dir / str(zoom)

    if not z_dir.exists():
        print(f"ERROR: Tile directory not found: {z_dir}", file=sys.stderr)
        sys.exit(1)

    x_dirs = sorted(z_dir.iterdir())
    total_x = len(x_dirs)
    total_tiles = 0
    total_features_raw = 0
    error_count = 0

    for i, x_dir in enumerate(x_dirs):
        if not x_dir.is_dir():
            continue
        tx = int(x_dir.name)

        mvt_files = sorted(x_dir.iterdir())
        for mvt_file in mvt_files:
            if not mvt_file.name.endswith(".mvt"):
                continue
            ty = int(mvt_file.stem)
            total_tiles += 1

            try:
                data = mvt_file.read_bytes()
                decoded = mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})
            except Exception as e:
                error_count += 1
                print(f"  WARN: Failed to decode {mvt_file}: {e}", file=sys.stderr)
                continue

            for layer_name, layer_data in decoded.items():
                for feature in layer_data.get("features", []):
                    total_features_raw += 1
                    props = clean_properties(feature.get("properties", {}))
                    guid = props.get("GUID")

                    if not guid:
                        continue

                    # Deduplicate by GUID - keep first occurrence
                    if guid in features:
                        continue

                    geom = feature.get("geometry", {})
                    if not geom or not geom.get("coordinates"):
                        continue

                    # Convert tile coords to WGS84
                    try:
                        wgs84_geom = convert_geometry(geom, zoom, tx, ty)
                    except Exception as e:
                        error_count += 1
                        print(f"  WARN: Geometry conversion failed for {guid}: {e}", file=sys.stderr)
                        continue

                    features[guid] = {
                        "type": "Feature",
                        "geometry": wgs84_geom,
                        "properties": props
                    }

        if (i + 1) % 10 == 0 or (i + 1) == total_x:
            print(f"  Progress: {i+1}/{total_x} x-dirs, {total_tiles} tiles, {len(features)} unique features")

    print(f"\nExtraction complete:")
    print(f"  Tiles processed: {total_tiles}")
    print(f"  Raw features: {total_features_raw}")
    print(f"  Unique features (by GUID): {len(features)}")
    print(f"  Duplicates removed: {total_features_raw - len(features)}")
    print(f"  Errors: {error_count}")

    return features


def write_geojson(features, output_path):
    """Write features dict to GeoJSON file."""
    collection = {
        "type": "FeatureCollection",
        "features": list(features.values())
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(collection, f, ensure_ascii=False)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  Output: {output_path} ({size_mb:.1f} MB)")


def print_summary(features):
    """Print summary statistics by LAYER_CD."""
    layer_counts = {}
    geom_types = {}
    for feat in features.values():
        layer_cd = feat["properties"].get("LAYER_CD", "UNKNOWN")
        geom_type = feat["geometry"]["type"]
        layer_counts[layer_cd] = layer_counts.get(layer_cd, 0) + 1
        geom_types[geom_type] = geom_types.get(geom_type, 0) + 1

    print("\nFeatures by LAYER_CD:")
    for code, count in sorted(layer_counts.items(), key=lambda x: -x[1]):
        print(f"  {code:8s}: {count:>7,}")

    print("\nFeatures by geometry type:")
    for gtype, count in sorted(geom_types.items(), key=lambda x: -x[1]):
        print(f"  {gtype:20s}: {count:>7,}")


def main():
    tile_dir = TILE_DIR
    output = OUTPUT_DIR / "pocheon_facilities.geojson"

    # Allow override via CLI args
    if len(sys.argv) > 1:
        tile_dir = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output = Path(sys.argv[2])

    print(f"MVT Facility Extraction")
    print(f"  Tile source: {tile_dir}")
    print(f"  Zoom level:  {ZOOM_LEVEL}")
    print(f"  Output:      {output}")
    print()

    features = extract_tiles(tile_dir, ZOOM_LEVEL)
    print_summary(features)

    print(f"\nWriting GeoJSON...")
    write_geojson(features, output)
    print("Done.")


if __name__ == "__main__":
    main()

#!/usr/bin/env bash
#
# Import Pocheon facility data: extract MVT tiles → GeoJSON → PostGIS
#
# Usage:
#   ./import_facilities.sh
#
# Prerequisites:
#   - Python venv with mapbox-vector-tile, shapely, psycopg2-binary
#   - PostgreSQL accessible (via PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD env vars)
#   - MVT tile data in origin/pocheon/node.pc/webapp/contents/facility/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
GEOJSON="${SCRIPT_DIR}/pocheon_facilities.geojson"

echo "=== Pocheon Facility Import Pipeline ==="
echo

# Step 0: Activate venv
if [ -d "${VENV_DIR}" ]; then
    source "${VENV_DIR}/bin/activate"
    echo "  Python venv activated: ${VENV_DIR}"
else
    echo "ERROR: Python venv not found at ${VENV_DIR}" >&2
    echo "  Create it with: uv venv ${VENV_DIR} && uv pip install mapbox-vector-tile shapely psycopg2-binary" >&2
    exit 1
fi

# Step 1: Seed facility types
echo "Step 1: Seeding facility types and layers..."
psql -h "${PGHOST:-postgres}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-gisdb}" \
    -f "${SCRIPT_DIR}/../seed_facilities.sql"
echo "  Done."
echo

# Step 2: Extract MVT → GeoJSON (skip if GeoJSON already exists)
if [ -f "${GEOJSON}" ]; then
    echo "Step 2: GeoJSON already exists, skipping extraction."
    echo "  ${GEOJSON} ($(du -h "${GEOJSON}" | cut -f1))"
else
    echo "Step 2: Extracting MVT tiles to GeoJSON..."
    python "${SCRIPT_DIR}/extract_mvt_facilities.py"
fi
echo

# Step 3: Import GeoJSON → PostGIS
echo "Step 3: Importing GeoJSON into PostGIS..."
python "${SCRIPT_DIR}/import_geojson_to_postgis.py"
echo

echo "=== Import complete ==="

#!/usr/bin/env bash
# ============================================================
# 레거시 데이터 마이그레이션 오케스트레이션 스크립트
# Shapefile(ua502, buildig_txt) → PostGIS(gisdb) 임포트 + 변환
#
# 사전 조건:
#   1. PostgreSQL(PostGIS) 컨테이너 실행 중 (make data)
#   2. GIS DB 초기화 완료 (make gis-init)
#   3. Shapefile 경로 지정 (SHP_DIR 환경변수 또는 기본값)
#
# 사용법:
#   make gis-migrate
#   또는: SHP_DIR=/path/to/shapefiles bash migrate-legacy.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${SCRIPT_DIR}/migration"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# .env 로드
if [ -f "$ROOT_DIR/.env" ]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

GIS_DB_NAME="${GIS_DB_NAME:-gisdb}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
CONTAINER="${POSTGRES_CONTAINER:-postgres}"

# Shapefile 기본 경로 (gis-utility-map 프로젝트 내 레거시 데이터)
SHP_DIR="${SHP_DIR:-/home/girinman/workspace/gis-utility-map/origin/pocheon/data/upload_shp}"

# PSQL 헬퍼
psql_exec() {
    docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${GIS_DB_NAME}" "$@"
}

echo "============================================"
echo " 레거시 데이터 마이그레이션"
echo " DB: ${GIS_DB_NAME} | Container: ${CONTAINER}"
echo " SHP_DIR: ${SHP_DIR}"
echo "============================================"
echo ""

# ── Step 0: 사전 검증 ──────────────────────────────────
echo "=== [0/6] 사전 검증 ==="

# DB 연결 테스트
if ! psql_exec -c "SELECT 1" > /dev/null 2>&1; then
    echo "ERROR: PostgreSQL 연결 실패. 'make data'를 먼저 실행하세요."
    exit 1
fi

# PostGIS 확장 확인
if ! psql_exec -tAc "SELECT 1 FROM pg_extension WHERE extname='postgis'" 2>/dev/null | grep -q 1; then
    echo "ERROR: PostGIS 확장이 없습니다. 'make gis-init'을 먼저 실행하세요."
    exit 1
fi

# gis.regions 테이블 확인
if ! psql_exec -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='gis' AND table_name='regions'" 2>/dev/null | grep -q 1; then
    echo "ERROR: gis.regions 테이블이 없습니다. 'make gis-init'을 먼저 실행하세요."
    exit 1
fi

# Shapefile 존재 확인
for shp in ua502.shp buildig_txt.shp; do
    if [ ! -f "${SHP_DIR}/${shp}" ]; then
        echo "ERROR: ${SHP_DIR}/${shp} 파일이 없습니다."
        exit 1
    fi
done

# shp2pgsql 존재 확인
if ! docker exec "${CONTAINER}" which shp2pgsql > /dev/null 2>&1; then
    echo "ERROR: shp2pgsql이 컨테이너에 없습니다. postgis/postgis 이미지를 사용하세요."
    exit 1
fi

# shp2pgsql 의존성 (libintl) 확인 및 설치
if ! docker exec "${CONTAINER}" sh -c "shp2pgsql 2>&1 | head -1" > /dev/null 2>&1; then
    echo "  -> shp2pgsql 의존성(gettext) 설치 중..."
    docker exec "${CONTAINER}" apk add --no-cache gettext > /dev/null 2>&1
fi

echo "  모든 사전 검증 통과."
echo ""

# ── Step 1: EPSG:5181 등록 확인 ──────────────────────────
echo "=== [1/6] EPSG:5181 좌표계 등록 확인 ==="

SRID_EXISTS=$(psql_exec -tAc "SELECT 1 FROM spatial_ref_sys WHERE srid = 5181" 2>/dev/null || true)
if [ "${SRID_EXISTS}" != "1" ]; then
    echo "  -> EPSG:5181 등록 중..."
    psql_exec -c "
INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext) VALUES (
    5181, 'EPSG', 5181,
    '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    'PROJCS[\"Korea 2000 / Central Belt\",GEOGCS[\"Korea 2000\",DATUM[\"Geocentric_datum_of_Korea\",SPHEROID[\"GRS 1980\",6378137,298.257222101,AUTHORITY[\"EPSG\",\"7019\"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY[\"EPSG\",\"6737\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4737\"]],PROJECTION[\"Transverse_Mercator\"],PARAMETER[\"latitude_of_origin\",38],PARAMETER[\"central_meridian\",127],PARAMETER[\"scale_factor\",1],PARAMETER[\"false_easting\",200000],PARAMETER[\"false_northing\",500000],UNIT[\"metre\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"5181\"]]'
);"
    echo "  EPSG:5181 등록 완료."
else
    echo "  EPSG:5181 이미 등록됨."
fi
echo ""

# ── Step 2: 포천시 지역 시드 ──────────────────────────────
echo "=== [2/6] 포천시 지역(region) 등록 ==="
psql_exec < "${MIGRATION_DIR}/06_seed_pocheon.sql"
echo "  포천시 지역 등록 완료."
echo ""

# ── Step 3: Shapefile → 스테이징 테이블 임포트 ──────────────
echo "=== [3/6] Shapefile → 스테이징 테이블 임포트 ==="

# 스테이징 스키마 생성
psql_exec -c "CREATE SCHEMA IF NOT EXISTS staging;"

# 기존 스테이징 테이블 삭제 (재실행 가능)
psql_exec -c "DROP TABLE IF EXISTS staging.ua502 CASCADE;"
psql_exec -c "DROP TABLE IF EXISTS staging.buildig_txt CASCADE;"

# ua502.shp 임포트
echo "  -> ua502.shp 임포트 중 (약 72MB, 시간 소요)..."
# shapefiles를 컨테이너로 복사
docker cp "${SHP_DIR}/ua502.shp" "${CONTAINER}:/tmp/ua502.shp"
docker cp "${SHP_DIR}/ua502.shx" "${CONTAINER}:/tmp/ua502.shx"
docker cp "${SHP_DIR}/ua502.dbf" "${CONTAINER}:/tmp/ua502.dbf"
if [ -f "${SHP_DIR}/ua502.prj" ]; then
    docker cp "${SHP_DIR}/ua502.prj" "${CONTAINER}:/tmp/ua502.prj"
fi
if [ -f "${SHP_DIR}/ua502.cpg" ]; then
    docker cp "${SHP_DIR}/ua502.cpg" "${CONTAINER}:/tmp/ua502.cpg"
fi

# shp2pgsql: -s 5181 = source SRID, -W CP949 = encoding, -c = create
docker exec "${CONTAINER}" sh -c \
    "shp2pgsql -s 5181 -W CP949 -c /tmp/ua502.shp staging.ua502 | psql -U ${POSTGRES_USER} -d ${GIS_DB_NAME} -q"

UA502_COUNT=$(psql_exec -tAc "SELECT count(*) FROM staging.ua502")
echo "  ua502: ${UA502_COUNT} rows imported."

# buildig_txt.shp 임포트
echo "  -> buildig_txt.shp 임포트 중..."
docker cp "${SHP_DIR}/buildig_txt.shp" "${CONTAINER}:/tmp/buildig_txt.shp"
docker cp "${SHP_DIR}/buildig_txt.shx" "${CONTAINER}:/tmp/buildig_txt.shx"
docker cp "${SHP_DIR}/buildig_txt.dbf" "${CONTAINER}:/tmp/buildig_txt.dbf"
if [ -f "${SHP_DIR}/buildig_txt.prj" ]; then
    docker cp "${SHP_DIR}/buildig_txt.prj" "${CONTAINER}:/tmp/buildig_txt.prj"
fi
if [ -f "${SHP_DIR}/buildig_txt.cpg" ]; then
    docker cp "${SHP_DIR}/buildig_txt.cpg" "${CONTAINER}:/tmp/buildig_txt.cpg"
fi

docker exec "${CONTAINER}" sh -c \
    "shp2pgsql -s 5181 -W CP949 -c /tmp/buildig_txt.shp staging.buildig_txt | psql -U ${POSTGRES_USER} -d ${GIS_DB_NAME} -q"

BLDG_COUNT=$(psql_exec -tAc "SELECT count(*) FROM staging.buildig_txt")
echo "  buildig_txt: ${BLDG_COUNT} rows imported."

# 임시 파일 정리
docker exec "${CONTAINER}" sh -c "rm -f /tmp/ua502.* /tmp/buildig_txt.*"
echo ""

# ── Step 4: 스테이징 → 타겟 테이블 변환 ─────────────────────
echo "=== [4/6] 스테이징 → 타겟 테이블 변환 ==="

echo "  -> ua502 → gis.parcels..."
psql_exec < "${MIGRATION_DIR}/07_migrate_parcels.sql"

echo "  -> buildig_txt → gis.buildings..."
psql_exec < "${MIGRATION_DIR}/08_migrate_buildings.sql"

echo ""

# ── Step 5: 레이어 메타데이터 시드 ────────────────────────────
echo "=== [5/6] 레이어 메타데이터 시드 ==="
psql_exec < "${MIGRATION_DIR}/09_seed_layers.sql"
echo "  레이어 메타데이터 등록 완료."
echo ""

# ── Step 6: 스테이징 테이블 정리 + 최종 검증 ─────────────────
echo "=== [6/6] 최종 검증 ==="

# 스테이징 정리 (옵션)
echo "  -> 스테이징 테이블 유지 (디버깅용). 삭제하려면: DROP SCHEMA staging CASCADE;"

# 최종 통계
echo ""
echo "── 마이그레이션 결과 ──"
psql_exec -c "
SELECT 'gis.regions' AS table_name, count(*) AS rows FROM gis.regions
UNION ALL
SELECT 'gis.parcels', count(*) FROM gis.parcels
UNION ALL
SELECT 'gis.buildings', count(*) FROM gis.buildings
UNION ALL
SELECT 'gis.facilities', count(*) FROM gis.facilities
UNION ALL
SELECT 'gis.layers', count(*) FROM gis.layers
UNION ALL
SELECT 'gis.facility_types', count(*) FROM gis.facility_types
ORDER BY table_name;
"

# region bbox 검증
echo "── 포천시 Region 정보 ──"
psql_exec -c "
SELECT code, name,
    ST_AsText(ST_SnapToGrid(bbox, 0.001)) AS bbox_wkt,
    ST_AsText(ST_SnapToGrid(center, 0.001)) AS center_wkt,
    zoom_min, zoom_max
FROM gis.regions WHERE code = 'POCHEON';
"

echo ""
echo "============================================"
echo " 마이그레이션 완료!"
echo ""
echo " 다음 단계:"
echo "   1. Elasticsearch 인덱싱: bash migration/10_setup_elasticsearch.sh"
echo "   2. GIS 서비스 시작: make gis"
echo "   3. 시설물 데이터는 레거시 DB 직접 연결 필요 (아래 참고)"
echo ""
echo " [시설물 마이그레이션 안내]"
echo "   현재 시설물(맨홀, 관로 등) 원본 데이터는 Shapefile로"
echo "   제공되지 않으며, MVT 정적 타일만 존재합니다."
echo "   마이그레이션 방법:"
echo "     A) 레거시 PostgreSQL DB 접근 가능 시: 직접 SQL 연결하여 추출"
echo "     B) MVT 타일에서 역추출: ogr2ogr -f PostgreSQL PG:... /contents/facility/{z}/{x}/{y}.mvt"
echo "     C) 원본 측량 데이터(SHP/DXF 등) 확보 시: shp2pgsql로 직접 임포트"
echo "============================================"

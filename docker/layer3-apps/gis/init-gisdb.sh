#!/usr/bin/env bash
set -euo pipefail

# GIS DB 생성 및 스키마 적용 스크립트
# 사용법: make gis-init (또는 직접 실행)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INITDB_DIR="${SCRIPT_DIR}/initdb"

# .env에서 변수 로드 (Makefile에서 호출 시 이미 export됨)
GIS_DB_NAME="${GIS_DB_NAME:-gisdb}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo "==> GIS DB 초기화 시작 (database: ${GIS_DB_NAME})"

# 1. DB 존재 여부 확인 및 생성
DB_EXISTS=$(docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${GIS_DB_NAME}'" 2>/dev/null || true)

if [ "${DB_EXISTS}" != "1" ]; then
    echo "  -> DB '${GIS_DB_NAME}' 생성 중..."
    docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -c \
        "CREATE DATABASE ${GIS_DB_NAME};"
else
    echo "  -> DB '${GIS_DB_NAME}' 이미 존재합니다."
fi

# 2. SQL 파일 순서대로 적용
for sql_file in "${INITDB_DIR}"/*.sql; do
    filename=$(basename "${sql_file}")
    echo "  -> 적용 중: ${filename}"
    docker exec -i postgres psql -U "${POSTGRES_USER}" -d "${GIS_DB_NAME}" < "${sql_file}"
done

# 3. 검증
echo "==> 스키마 검증"
docker exec -i postgres psql -U "${POSTGRES_USER}" -d "${GIS_DB_NAME}" -c \
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('gis', 'auth', 'audit') ORDER BY schemaname, tablename;"

echo "==> PostGIS 버전 확인"
docker exec -i postgres psql -U "${POSTGRES_USER}" -d "${GIS_DB_NAME}" -c \
    "SELECT postgis_full_version();"

echo "==> GIS DB 초기화 완료!"

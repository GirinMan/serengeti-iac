#!/bin/sh
set -eu

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="/dumps/postgres_${TIMESTAMP}.sql"

echo "[$(date)] PostgreSQL 덤프 시작"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  > "$DUMP_FILE"
gzip "$DUMP_FILE"
echo "[$(date)] PostgreSQL 덤프 완료: ${DUMP_FILE}.gz"

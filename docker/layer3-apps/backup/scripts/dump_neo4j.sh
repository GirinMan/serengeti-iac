#!/bin/sh
set -eu

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TMP_DIR="/tmp/neo4j-backup-${TIMESTAMP}"
DUMP_FILE="/dumps/neo4j_${TIMESTAMP}.dump"

echo "[$(date)] Neo4j 덤프 시작"
docker exec "$NEO4J_CONTAINER" mkdir -p "$TMP_DIR"
docker exec "$NEO4J_CONTAINER" neo4j-admin database dump neo4j \
  --to-path="$TMP_DIR" \
  --overwrite-destination=true
docker cp "${NEO4J_CONTAINER}:${TMP_DIR}/neo4j.dump" "$DUMP_FILE"
docker exec "$NEO4J_CONTAINER" rm -rf "$TMP_DIR"
gzip "$DUMP_FILE"
echo "[$(date)] Neo4j 덤프 완료: ${DUMP_FILE}.gz"

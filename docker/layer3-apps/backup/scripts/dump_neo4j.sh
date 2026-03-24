#!/bin/sh
set -eu

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="/dumps/neo4j_${TIMESTAMP}.dump"
CONTAINER_NAME="${NEO4J_CONTAINER:-neo4j}"
NEO4J_VERSION="${NEO4J_VERSION:?NEO4J_VERSION is required}"
NEO4J_DATA_DIR="${NEO4J_DATA_DIR:?NEO4J_DATA_DIR is required}"
DUMPS_DIR="${DUMPS_DIR:-/dumps}"
TMP_NAME="neo4j-backup-${TIMESTAMP}"
STOPPED=0

cleanup() {
  if [ "${STOPPED}" -eq 1 ]; then
    echo "[$(date)] Neo4j 컨테이너 재시작"
    docker start "${CONTAINER_NAME}" >/dev/null
  fi
}

trap cleanup EXIT

echo "[$(date)] Neo4j 덤프 시작"

docker stop "${CONTAINER_NAME}" >/dev/null
STOPPED=1

docker run --rm \
  --name "${TMP_NAME}" \
  -v "${NEO4J_DATA_DIR}:/data:ro" \
  -v "${DUMPS_DIR}:/dumps" \
  "neo4j:${NEO4J_VERSION}" \
  neo4j-admin database dump neo4j \
  --to-path=/dumps \
  --overwrite-destination=true

mv /dumps/neo4j.dump "$DUMP_FILE"
gzip "$DUMP_FILE"
echo "[$(date)] Neo4j 덤프 완료: ${DUMP_FILE}.gz"

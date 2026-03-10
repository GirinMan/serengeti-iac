#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RAW_DIR="$ROOT_DIR/inventory/raw"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$RAW_DIR/runtime-snapshot-${TIMESTAMP}.txt"

mkdir -p "$RAW_DIR"

{
  echo "# Runtime Snapshot"
  echo "timestamp=$TIMESTAMP"
  echo "hostname=$(hostname)"
  echo

  echo "## Docker PS"
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true
  echo

  echo "## Container Health"
  for c in \
    postgres mariadb neo4j elasticsearch redis kafka minio rabbitmq \
    npm wordpress-blog nextcloud plane-api plane-worker plane-beat-worker \
    plane-live plane-web plane-admin plane-space plane-proxy plane-migrator \
    backup-pipeline
  do
    if docker inspect "$c" >/dev/null 2>&1; then
      docker inspect --format '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c"
    fi
  done
  echo

  echo "## Docker Networks"
  docker network ls || true
  echo

  echo "## Storage"
  df -h / /mnt/primary /mnt/archive 2>/dev/null || true
  echo

  echo "## ZFS"
  zpool status archive 2>/dev/null || true
  echo
  zfs list archive 2>/dev/null || true
  echo

  echo "## Systemd"
  systemctl is-active docker ssh ufw cloudflared 2>/dev/null || true
} >"$OUT_FILE"

echo "Saved runtime snapshot to $OUT_FILE"

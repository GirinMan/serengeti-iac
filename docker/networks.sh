#!/usr/bin/env bash
set -euo pipefail

echo "[Docker] 네트워크 생성"
docker network create proxy-tier >/dev/null 2>&1 || echo "proxy-tier 이미 존재"
docker network create data-tier >/dev/null 2>&1 || echo "data-tier 이미 존재"
docker network ls | grep -E "proxy-tier|data-tier" || true
echo "[Docker] 네트워크 생성 완료"

#!/bin/bash
set -euo pipefail

# Docker 기반 포트폴리오 웹사이트 빌드 및 배포 스크립트
# 사용법: bash build.sh
#
# 구조: 이 프로젝트의 astro-blog 컨테이너는 Dockerfile 의 multi-stage build 로
# dist/ 를 이미지 내부에 베이크해서 서빙한다. 따라서 소스 수정 후에는
# 이미지 자체를 다시 빌드하고 컨테이너를 교체해야 한다.
#
# 전제: 호스트에 docker / docker compose 가 설치되어 있어야 한다.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
IMAGE_TAG="astro-blog:1.0.0"

echo "[Portfolio] Docker 이미지 재빌드 시작"

if ! command -v docker &>/dev/null; then
  echo "오류: docker 가 설치되어 있지 않습니다."
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "오류: compose 파일을 찾을 수 없습니다: $COMPOSE_FILE"
  exit 1
fi

# --- 1. 이미지 빌드 (--no-cache 로 소스 변경이 반드시 반영되도록 강제) ---
echo ">> docker compose build --no-cache astro-blog"
docker compose -f "$COMPOSE_FILE" build --no-cache astro-blog

# --- 2. 새 이미지로 컨테이너 교체 ---
echo ">> docker compose up -d --force-recreate astro-blog"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate astro-blog

# --- 3. 상태 확인 ---
echo ">> 컨테이너 상태"
docker ps --filter name=astro-blog --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# --- 4. dangling 이미지 정리(이전 astro-blog 이미지 레이어) ---
echo ">> dangling 이미지 정리"
docker image prune -f >/dev/null || true

echo ""
echo "========================================="
echo "[Portfolio] Docker 이미지 재빌드 및 재배포 완료"
echo "이미지 태그: $IMAGE_TAG"
echo "========================================="

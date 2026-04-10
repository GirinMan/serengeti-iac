#!/bin/bash
set -euo pipefail

# 포트폴리오 웹사이트 빌드 및 배포 스크립트
# 사용법: bash build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/src"
BUILD_OUTPUT="${SRC_DIR}/dist"
DEPLOY_TARGET="/mnt/archive/astro-blog/dist"

echo "[Portfolio] 빌드 시작"

# 소스 디렉토리 확인
if [[ ! -d "$SRC_DIR" ]]; then
  echo "오류: Astro 소스 디렉토리가 없습니다: $SRC_DIR"
  echo "다음 명령으로 Astro 프로젝트를 초기화하세요:"
  echo "  cd $SCRIPT_DIR"
  echo "  mkdir -p src && cd src"
  echo "  npm create astro@latest ."
  exit 1
fi

# Node.js 확인 (>=22.12.0 필요)
if ! command -v node &>/dev/null; then
  echo "오류: Node.js가 설치되지 않았습니다."
  exit 1
fi

NODE_VER=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "오류: Node.js >= 22.12.0 이 필요합니다. 현재 버전: v${NODE_VER}"
  exit 1
fi

# 의존성 설치
echo ">> 의존성 확인 및 설치"
cd "$SRC_DIR"
if [[ ! -d "node_modules" ]]; then
  echo "node_modules가 없습니다. npm install 실행..."
  npm install
fi

# Astro 빌드
echo ">> Astro 빌드 실행 (npm run build)"
npm run build

# 빌드 결과 확인
if [[ ! -d "$BUILD_OUTPUT" ]]; then
  echo "오류: 빌드 실패. dist/ 디렉토리가 생성되지 않았습니다."
  exit 1
fi

# 배포 디렉토리 생성
echo ">> 배포 디렉토리 준비: $DEPLOY_TARGET"
sudo mkdir -p "$DEPLOY_TARGET"
sudo chown -R "$USER:$USER" "$DEPLOY_TARGET"

# 기존 파일 백업 (선택 사항)
if [[ -d "$DEPLOY_TARGET" ]] && [[ -n "$(ls -A "$DEPLOY_TARGET")" ]]; then
  BACKUP_DIR="/mnt/archive/astro-blog/backup-$(date +%Y%m%d-%H%M%S)"
  echo ">> 기존 파일 백업: $BACKUP_DIR"
  sudo mkdir -p "$BACKUP_DIR"
  sudo cp -r "$DEPLOY_TARGET"/* "$BACKUP_DIR/" || true
fi

# 빌드 결과 배포
echo ">> 빌드 결과 배포 (dist/ → $DEPLOY_TARGET)"
sudo rm -rf "${DEPLOY_TARGET:?}"/*
sudo cp -r "$BUILD_OUTPUT"/* "$DEPLOY_TARGET/"
sudo chown -R 101:101 "$DEPLOY_TARGET"  # nginx 컨테이너 user:group

# 권한 확인
echo ">> 배포 완료. 파일 권한 확인:"
ls -lh "$DEPLOY_TARGET" | head -n 10

# Docker 컨테이너 재시작
if docker ps --format '{{.Names}}' | grep -q '^astro-blog$'; then
  echo ">> astro-blog 컨테이너 재시작"
  docker restart astro-blog
  sleep 2
  docker ps --filter name=astro-blog --format "table {{.Names}}\t{{.Status}}"
else
  echo "경고: astro-blog 컨테이너가 실행 중이지 않습니다."
  echo "다음 명령으로 컨테이너를 시작하세요:"
  echo "  docker compose -f $SCRIPT_DIR/docker-compose.yml up -d"
fi

echo ""
echo "========================================="
echo "[Portfolio] 빌드 및 배포 완료"
echo "배포 경로: $DEPLOY_TARGET"
echo "NPM Proxy Host를 통해 접속하세요."
echo "========================================="

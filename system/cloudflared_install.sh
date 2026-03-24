#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env 파일이 없습니다. cp .env.example .env 후 값을 채우세요."
  exit 1
fi

# shellcheck disable=SC1091
source "${ROOT_DIR}/system/lib_env.sh"
load_env_file "${ENV_FILE}"

echo "[Layer 1] Cloudflare Tunnel 설치 시작"

if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
    sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
    sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y cloudflared
else
  echo "cloudflared 이미 설치됨"
fi

if [[ -z "${CF_TUNNEL_TOKEN:-}" || "${CF_TUNNEL_TOKEN}" == *"<"* ]]; then
  echo "CF_TUNNEL_TOKEN이 없어 패키지 설치만 완료합니다."
  echo "토큰 준비 후 동일 스크립트를 다시 실행하면 서비스 등록을 진행합니다."
  exit 0
fi

sudo cloudflared service install "${CF_TUNNEL_TOKEN}"
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager

echo "[Layer 1] Cloudflare Tunnel 설치 완료"

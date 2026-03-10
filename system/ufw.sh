#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env 파일이 없습니다. cp .env.example .env 후 값을 채우세요."
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

for required in LOCAL_GW LOCAL_SUBNET SSH_PORT; do
  if [[ -z "${!required:-}" || "${!required}" == *"<"* ]]; then
    echo "오류: ${required} 값이 설정되지 않았습니다."
    exit 1
  fi
done

echo "[Layer 0] UFW 방화벽 설정 시작"

sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from "${LOCAL_GW}" to any comment "Room router full access"
sudo ufw allow from "${LOCAL_SUBNET}" to any port "${SSH_PORT}" proto tcp comment "SSH from admin subnet"
sudo ufw allow in on lo comment "Loopback"
sudo ufw --force enable
sudo ufw status verbose

echo "[Layer 0] UFW 방화벽 설정 완료"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

TIMEZONE="${TIMEZONE:-Asia/Seoul}"
INSTALL_NVIDIA_TOOLKIT="${INSTALL_NVIDIA_TOOLKIT:-false}"

echo "[Layer 0] 시스템 기초 설정 시작"

echo ">> apt 업데이트 및 업그레이드"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade

echo ">> 필수 패키지 설치"
sudo apt-get install -y \
  curl wget git vim htop tmux tree unzip jq \
  ufw fail2ban \
  ca-certificates gnupg lsb-release software-properties-common \
  zfsutils-linux borgbackup unattended-upgrades

echo ">> Docker 설치"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "${USER}"
  echo "Docker 설치 완료. 그룹 반영을 위해 재로그인이 필요할 수 있습니다."
else
  echo "Docker 이미 설치됨"
fi

echo ">> Docker Compose 플러그인 설치"
sudo apt-get install -y docker-compose-plugin

if [[ "${INSTALL_NVIDIA_TOOLKIT}" == "true" ]]; then
  echo ">> Nvidia Container Toolkit 설치"
  distribution=$(. /etc/os-release; echo "${ID}${VERSION_ID}")
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L "https://nvidia.github.io/libnvidia-container/${distribution}/libnvidia-container.list" | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y nvidia-container-toolkit
  sudo systemctl restart docker
fi

echo ">> 자동 보안 업데이트 설정"
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo ">> 타임존 설정: ${TIMEZONE}"
sudo timedatectl set-timezone "${TIMEZONE}"

echo "[Layer 0] 시스템 기초 설정 완료"

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

if [[ -z "${PRIMARY_SSD_DISK:-}" || "${PRIMARY_SSD_DISK}" == *"<"* ]]; then
  echo "오류: PRIMARY_SSD_DISK 값이 설정되지 않았습니다."
  exit 1
fi

PRIMARY_STORAGE_ROOT="${PRIMARY_STORAGE_ROOT:-/mnt/primary}"

echo "[Layer 0] Primary Storage 마운트 시작"
echo "대상 디스크: ${PRIMARY_SSD_DISK}"
echo "주의: 파티션 생성 및 포맷 작업이 포함될 수 있습니다."
read -r -p "계속하려면 'yes' 입력: " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "중단됨."
  exit 1
fi

PARTITION="${PRIMARY_SSD_DISK}-part1"

if [[ -b "${PARTITION}" ]]; then
  CURRENT_MOUNT="$(findmnt -nr -S "${PARTITION}" -o TARGET || true)"
  if [[ -n "${CURRENT_MOUNT}" && "${CURRENT_MOUNT}" != "${PRIMARY_STORAGE_ROOT}" ]]; then
    echo "오류: ${PARTITION} 이(가) 이미 ${CURRENT_MOUNT} 에 마운트되어 있습니다."
    echo "현재 서버 상태를 유지한 채 진행하려면 .env 의 PRIMARY_STORAGE_ROOT 를 ${CURRENT_MOUNT} 로 맞추거나,"
    echo "별도 마이그레이션 절차 후 다시 실행하세요."
    exit 1
  fi
fi

if [[ ! -b "${PARTITION}" ]]; then
  echo ">> GPT 파티션 생성"
  sudo parted -s "${PRIMARY_SSD_DISK}" mklabel gpt
  sudo parted -s "${PRIMARY_SSD_DISK}" mkpart primary ext4 0% 100%
  sudo partprobe "${PRIMARY_SSD_DISK}"
fi

if ! sudo blkid "${PARTITION}" >/dev/null 2>&1; then
  echo ">> ext4 파일시스템 생성"
  sudo mkfs.ext4 -F "${PARTITION}"
fi

sudo mkdir -p "${PRIMARY_STORAGE_ROOT}"

UUID="$(sudo blkid -s UUID -o value "${PARTITION}")"
if ! grep -q "${UUID}" /etc/fstab; then
  echo ">> /etc/fstab 업데이트"
  echo "UUID=${UUID} ${PRIMARY_STORAGE_ROOT} ext4 defaults,noatime 0 2" | sudo tee -a /etc/fstab >/dev/null
fi

sudo mount -a
sudo mkdir -p \
  "${PRIMARY_STORAGE_ROOT}/postgres" \
  "${PRIMARY_STORAGE_ROOT}/neo4j/data" \
  "${PRIMARY_STORAGE_ROOT}/neo4j/logs" \
  "${PRIMARY_STORAGE_ROOT}/elasticsearch" \
  "${PRIMARY_STORAGE_ROOT}/kafka" \
  "${PRIMARY_STORAGE_ROOT}/redis" \
  "${PRIMARY_STORAGE_ROOT}/dumps"
sudo chown -R "${USER}:${USER}" "${PRIMARY_STORAGE_ROOT}"

df -h "${PRIMARY_STORAGE_ROOT}"
echo "[Layer 0] Primary Storage 마운트 완료"

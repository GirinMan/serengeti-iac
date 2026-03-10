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

if [[ -z "${PRIMARY_SSD_DISK:-}" || "${PRIMARY_SSD_DISK}" == *"<"* ]]; then
  echo "오류: PRIMARY_SSD_DISK 값이 설정되지 않았습니다."
  exit 1
fi

echo "[Layer 0] Primary Storage 마운트 시작"
echo "대상 디스크: ${PRIMARY_SSD_DISK}"
echo "주의: 파티션 생성 및 포맷 작업이 포함될 수 있습니다."
read -r -p "계속하려면 'yes' 입력: " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "중단됨."
  exit 1
fi

PARTITION="${PRIMARY_SSD_DISK}-part1"

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

sudo mkdir -p /mnt/primary

UUID="$(sudo blkid -s UUID -o value "${PARTITION}")"
if ! grep -q "${UUID}" /etc/fstab; then
  echo ">> /etc/fstab 업데이트"
  echo "UUID=${UUID} /mnt/primary ext4 defaults,noatime 0 2" | sudo tee -a /etc/fstab >/dev/null
fi

sudo mount -a
sudo mkdir -p \
  /mnt/primary/postgres \
  /mnt/primary/neo4j/data \
  /mnt/primary/neo4j/logs \
  /mnt/primary/elasticsearch \
  /mnt/primary/kafka \
  /mnt/primary/redis \
  /mnt/primary/dumps
sudo chown -R "${USER}:${USER}" /mnt/primary

df -h /mnt/primary
echo "[Layer 0] Primary Storage 마운트 완료"

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

require_value() {
  local name="$1"
  local value="$2"
  if [[ -z "${value}" || "${value}" == *"<"* ]]; then
    echo "오류: ${name} 값이 설정되지 않았습니다."
    exit 1
  fi
}

require_value "ZFS_DISK1" "${ZFS_DISK1:-}"
require_value "ZFS_DISK2" "${ZFS_DISK2:-}"

echo "[Layer 0] ZFS Archive Storage 구성 시작"
echo "대상 디스크:"
echo "  - ${ZFS_DISK1}"
echo "  - ${ZFS_DISK2}"
echo "주의: 이 작업은 대상 디스크를 초기화할 수 있습니다."
read -r -p "계속하려면 'yes' 입력: " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "중단됨."
  exit 1
fi

if ! sudo zpool list archive >/dev/null 2>&1; then
  echo ">> ZFS Pool 'archive' 생성"
  sudo zpool create -f archive mirror "${ZFS_DISK1}" "${ZFS_DISK2}"
else
  echo "archive 풀이 이미 존재하므로 생성 단계는 건너뜁니다."
fi

echo ">> ZFS 속성 설정"
sudo zfs set compression=lz4 archive
sudo zfs set mountpoint=/mnt/archive archive
sudo zfs set com.sun:auto-snapshot=true archive
sudo zfs set com.sun:auto-snapshot:frequent=false archive
sudo zfs set com.sun:auto-snapshot:hourly=true archive
sudo zfs set com.sun:auto-snapshot:daily=true archive
sudo zfs set com.sun:auto-snapshot:weekly=true archive
sudo zfs set com.sun:auto-snapshot:monthly=true archive

echo ">> zfs-auto-snapshot 설치"
sudo apt-get install -y zfs-auto-snapshot

sudo mkdir -p /mnt/archive/{minio,nextcloud,borg-repo,backup}
sudo chown -R "${USER}:${USER}" /mnt/archive

echo ">> ZFS 상태 확인"
sudo zpool status archive
sudo zfs list archive

echo "[Layer 0] ZFS Archive Storage 구성 완료"

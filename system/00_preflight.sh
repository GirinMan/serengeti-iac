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

PRIMARY_STORAGE_ROOT="${PRIMARY_STORAGE_ROOT:-/mnt/primary}"
ARCHIVE_STORAGE_ROOT="${ARCHIVE_STORAGE_ROOT:-/mnt/archive}"
WARNINGS=0
BLOCKERS=0

info() {
  echo "[INFO] $*"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  echo "[WARN] $*"
}

block() {
  BLOCKERS=$((BLOCKERS + 1))
  echo "[BLOCK] $*"
}

require_configured_value() {
  local name="$1"
  local value="${2:-}"

  if [[ -z "${value}" || "${value}" == *"<"* ]]; then
    block "${name} 값이 비어 있거나 플레이스홀더 상태입니다."
  fi
}

partition_mount_target() {
  local device="$1"
  local part="${device}-part1"

  if [[ -b "${part}" ]]; then
    findmnt -nr -S "${part}" -o TARGET 2>/dev/null || true
    return 0
  fi

  lsblk -nrpo NAME,TYPE "${device}" 2>/dev/null | awk '$2 == "part" {print $1; exit}' | while read -r part_name; do
    findmnt -nr -S "${part_name}" -o TARGET 2>/dev/null || true
    break
  done
}

filesystem_summary() {
  local device="$1"
  lsblk -nrpo NAME,FSTYPE,MOUNTPOINTS "${device}" 2>/dev/null || true
}

check_service_unit() {
  local label="$1"
  shift
  local unit

  for unit in "$@"; do
    if systemctl list-unit-files "${unit}" --no-legend 2>/dev/null | grep -q "${unit}"; then
      info "${label} unit detected: ${unit}"
      return
    fi
  done

  warn "${label} systemd unit 미확인"
}

echo "[Layer 0] Preflight 시작"
info "hostname=$(hostname -s 2>/dev/null || hostname)"
info "primary_root=${PRIMARY_STORAGE_ROOT}"
info "archive_root=${ARCHIVE_STORAGE_ROOT}"

require_configured_value "PRIMARY_SSD_DISK" "${PRIMARY_SSD_DISK:-}"
require_configured_value "ZFS_DISK1" "${ZFS_DISK1:-}"
require_configured_value "ZFS_DISK2" "${ZFS_DISK2:-}"

if [[ -n "${PRIMARY_SSD_DISK:-}" && "${PRIMARY_SSD_DISK}" != *"<"* ]]; then
  PRIMARY_CURRENT_MOUNT="$(partition_mount_target "${PRIMARY_SSD_DISK}")"
  if [[ -n "${PRIMARY_CURRENT_MOUNT}" && "${PRIMARY_CURRENT_MOUNT}" != "${PRIMARY_STORAGE_ROOT}" ]]; then
    block "Primary SSD is already mounted at ${PRIMARY_CURRENT_MOUNT}; target is ${PRIMARY_STORAGE_ROOT}. Migration or env override is required."
  elif [[ -n "${PRIMARY_CURRENT_MOUNT}" ]]; then
    info "Primary SSD already mounted at target path ${PRIMARY_CURRENT_MOUNT}."
  else
    warn "Primary SSD is not mounted yet."
  fi
fi

if mountpoint -q "${PRIMARY_STORAGE_ROOT}"; then
  info "${PRIMARY_STORAGE_ROOT} is already mounted."
else
  warn "${PRIMARY_STORAGE_ROOT} is not mounted."
fi

if mountpoint -q "${ARCHIVE_STORAGE_ROOT}"; then
  info "${ARCHIVE_STORAGE_ROOT} is already mounted."
else
  warn "${ARCHIVE_STORAGE_ROOT} is not mounted."
fi

for disk_var in ZFS_DISK1 ZFS_DISK2; do
  disk="${!disk_var:-}"
  if [[ -z "${disk}" || "${disk}" == *"<"* ]]; then
    continue
  fi

  summary="$(filesystem_summary "${disk}")"
  if grep -Eq '[[:space:]](ext4|xfs|ntfs|zfs|btrfs)[[:space:]]' <<<"${summary}"; then
    block "${disk_var} already contains a filesystem or partition layout. Review before running ZFS initialization."
    echo "${summary}"
  else
    info "${disk_var} appears unused."
  fi
done

if command -v zpool >/dev/null 2>&1 && sudo zpool list archive >/dev/null 2>&1; then
  info "ZFS archive pool already exists."
else
  warn "ZFS archive pool is not present."
fi

for cmd in docker ufw sshd cloudflared; do
  if command -v "${cmd}" >/dev/null 2>&1; then
    info "${cmd} is installed."
  else
    warn "${cmd} is not installed."
  fi
done

if systemctl list-unit-files >/dev/null 2>&1; then
  check_service_unit "SSH" ssh.service sshd.service
  check_service_unit "Docker" docker.service
  check_service_unit "cloudflared" cloudflared.service
fi

if [[ -f /etc/ssh/sshd_config ]]; then
  info "/etc/ssh/sshd_config is present."
else
  warn "/etc/ssh/sshd_config is missing."
fi

if command -v ufw >/dev/null 2>&1; then
  if sudo ufw status | head -n1 | grep -q "Status: active"; then
    info "UFW is active."
  else
    warn "UFW is installed but inactive."
  fi
fi

echo
echo "Warnings: ${WARNINGS}"
echo "Blockers: ${BLOCKERS}"

if (( BLOCKERS > 0 )); then
  echo "Preflight result: blockers detected"
  exit 2
fi

echo "Preflight result: safe to continue with non-destructive steps"

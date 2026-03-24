#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/docs/raw"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
HOSTNAME_SHORT="$(hostname -s 2>/dev/null || echo unknown-host)"
OUTPUT_FILE="${OUTPUT_DIR}/host-state-${HOSTNAME_SHORT}-${TIMESTAMP}.txt"

mkdir -p "${OUTPUT_DIR}"

run_section() {
  local title="$1"
  shift

  {
    printf '\n## %s\n' "${title}"
    "$@"
  } >>"${OUTPUT_FILE}" 2>&1 || {
    printf '\n## %s\n(command failed)\n' "${title}" >>"${OUTPUT_FILE}"
  }
}

{
  echo "# Host State Inventory"
  echo "generated_at=$(date --iso-8601=seconds)"
  echo "hostname=${HOSTNAME_SHORT}"
} >"${OUTPUT_FILE}"

run_section "uname" uname -a
run_section "os-release" cat /etc/os-release
run_section "timedatectl" timedatectl
run_section "uptime" uptime
run_section "ip-address" ip -brief address
run_section "ip-route" ip route
run_section "ss-listen" ss -tulpn
run_section "lsblk" lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL,SERIAL
run_section "findmnt" findmnt -R /
run_section "df" df -hT
run_section "fstab" cat /etc/fstab

if command -v zpool >/dev/null 2>&1; then
  run_section "zpool-status" sudo zpool status
  run_section "zfs-list" sudo zfs list
fi

if command -v ufw >/dev/null 2>&1; then
  run_section "ufw-status" sudo ufw status verbose
fi

if systemctl list-unit-files >/dev/null 2>&1; then
  run_section "systemctl-cloudflared" systemctl status cloudflared --no-pager
  run_section "systemctl-ssh" systemctl status ssh --no-pager
  run_section "systemctl-docker" systemctl status docker --no-pager
fi

run_section "sshd-config" sudo grep -E '^(Port|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|AllowUsers)' /etc/ssh/sshd_config

if command -v docker >/dev/null 2>&1; then
  run_section "docker-info" docker info
  run_section "docker-ps" docker ps -a
  run_section "docker-network-ls" docker network ls
  run_section "docker-volume-ls" docker volume ls
fi

echo "inventory written to ${OUTPUT_FILE}"

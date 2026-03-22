#!/usr/bin/env bash
set -euo pipefail

echo "# Storage inventory"
lsblk -dn -P -o NAME,SIZE,MODEL,SERIAL,TYPE | grep 'TYPE="disk"'

echo
echo "# Candidate /dev/disk/by-id paths"
for path in /dev/disk/by-id/*; do
  name="$(basename "${path}")"
  case "${name}" in
    *part*|wwn-*|nvme-eui.*)
      continue
      ;;
  esac
  if [[ -b "${path}" ]]; then
    printf '%s -> %s\n' "${name}" "$(readlink -f "${path}")"
  fi
done | sort

echo
echo "# Suggested .env snippet"

primary_candidate="$(ls -1 /dev/disk/by-id 2>/dev/null | grep -m1 'Samsung_SSD_970_EVO_Plus_500GB' || true)"
hdd_candidates="$(ls -1 /dev/disk/by-id 2>/dev/null | grep '^ata-' | grep -v 'part' | sort || true)"

if [[ -n "${primary_candidate}" ]]; then
  echo "PRIMARY_SSD_DISK=/dev/disk/by-id/${primary_candidate}"
else
  echo "PRIMARY_SSD_DISK=/dev/disk/by-id/<primary_ssd_disk_id>"
fi

zfs_disk1="$(sed -n '1p' <<<"${hdd_candidates}")"
zfs_disk2="$(sed -n '2p' <<<"${hdd_candidates}")"

if [[ -n "${zfs_disk1}" ]]; then
  echo "ZFS_DISK1=/dev/disk/by-id/${zfs_disk1}"
else
  echo "ZFS_DISK1=/dev/disk/by-id/<zfs_disk1_id>"
fi

if [[ -n "${zfs_disk2}" ]]; then
  echo "ZFS_DISK2=/dev/disk/by-id/${zfs_disk2}"
else
  echo "ZFS_DISK2=/dev/disk/by-id/<zfs_disk2_id>"
fi

echo
echo "# Mountpoint summary"
findmnt -rn -o TARGET,SOURCE,FSTYPE | grep -E '^(/|/data|/mnt/primary|/mnt/archive) ' || true

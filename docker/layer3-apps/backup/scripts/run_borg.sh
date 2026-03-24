#!/bin/sh
set -eu

REPO="${BORG_REPO}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"

echo "[$(date)] BorgBackup 시작"

mkdir -p "$REPO"
if ! borg info "$REPO" >/dev/null 2>&1; then
  echo "Borg Repository 초기화"
  borg init --encryption=repokey "$REPO"
fi

borg create \
  --stats \
  --compression lz4 \
  "$REPO::backup-${TIMESTAMP}" \
  /dumps

borg prune \
  --keep-daily=7 \
  --keep-weekly=4 \
  --keep-monthly=6 \
  "$REPO"

echo "[$(date)] BorgBackup 완료"

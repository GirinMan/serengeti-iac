# Current Host Audit

기준 문서: `AGENTS.md`  
수집 일시: `2026-03-10`  
원본 수집 파일: `inventory/raw/host-state-*.txt` (Git 제외)

## 요약

현재 작업 중인 호스트는 목표 홈랩 서버 최종 상태가 아니다. Ubuntu 24.04 계열 호스트이긴 하지만, 서버 런타임 계층은 아직 대부분 미구축 상태다.

## 설계 대비 현재 상태

- OS 루트 SSD 역할은 설계와 일치한다.
  - 1TB NVMe가 `/`에 마운트되어 있다.
- 보조 SSD의 마운트 포인트가 설계와 다르다.
  - 설계 목표는 `PRIMARY_STORAGE_ROOT=/mnt/primary` 이지만, 현재는 500GB NVMe가 `/data`에 ext4로 마운트되어 있다.
- Archive ZFS 계층은 아직 없다.
  - 8TB HDD 2개는 ZFS mirror가 아니며 `ARCHIVE_STORAGE_ROOT`도 없다.
  - 디스크 중 최소 1개에는 기존 NTFS 파티션이 존재한다.
- Layer 0/1 핵심 서비스는 아직 미구축 상태로 보인다.
  - `docker`, `cloudflared`, `openssh-server`, `zfsutils-linux`가 확인되지 않았다.
  - `ufw`는 설치되어 있으나 비활성 상태다.

## 운영 해석

- 현재 호스트는 목표 홈랩 서버보다는 일반 Ubuntu 워크스테이션 또는 데스크톱에 가깝다.
- 따라서 `system/02_zfs_archive.sh`, `system/03_mount_primary.sh`, `system/01_setup.sh`를 곧바로 실행하는 것은 안전하지 않다.
- 특히 보조 SSD는 이미 `/data`로 사용 중이고, 8TB HDD 중 하나는 기존 파일시스템이 있어 파괴적 작업 전 사람이 의사결정을 해야 한다.

## 즉시 반영한 IaC 변경

- 호스트 bind mount 경로를 `.env` 기반으로 변수화했다.
  - `PRIMARY_STORAGE_ROOT`
  - `ARCHIVE_STORAGE_ROOT`
  - `DUMPS_DIR`
  - `BORG_REPO_HOST_PATH`
- `system/03_mount_primary.sh`는 대상 파티션이 다른 경로에 이미 마운트된 경우 중단하도록 바꿨다.
- `system/00_preflight.sh`를 추가해 Layer 0 적용 전 위험 요소를 자동 점검하도록 했다.

## 사람 확인이 필요한 항목

- 500GB SSD를 계속 `/data`로 유지할지, `PRIMARY_STORAGE_ROOT`를 `/data`로 채택할지, 아니면 `/mnt/primary`로 마이그레이션할지 결정
- 8TB HDD 2개를 ZFS mirror로 재구성해도 되는지, 기존 NTFS 데이터 보존이 필요한지 결정
- 이 호스트가 실제 목표 서버인지, 아니면 개발용/운영자용 워크스테이션인지 확정

# Current Host Audit (2026-03-10)

이 문서는 2026-03-10에 `inventory/scripts/collect_host_state.sh`로 수집한 원본 인벤토리를 마스킹해 요약한 결과다.

## Host Summary

- OS: Ubuntu 24.04.4 LTS
- Kernel: `6.17.0-14-generic`
- Timezone: `Asia/Seoul`
- Active NIC: 단일 유선 인터페이스 1개
- Active subnet: `<server_private_subnet>`
- Default gateway: `<building_router_ip>`

## Storage Summary

- 1TB NVMe SSD
  - 현재 `/` 에 마운트됨
  - 최신 `AGENTS.md`의 `OS Root` 역할과 일치
- 500GB NVMe SSD
  - 현재 ext4로 포맷되어 `/data` 에 마운트됨
  - 목표 설계의 `/mnt/primary` 와 경로가 다름
- 8TB HDD x2
  - ZFS mirror 미구성
  - `/mnt/archive` 미존재
  - 최소 1개 디스크에는 기존 `ntfs` 파티션이 존재함

## Service Summary

- `ufw`
  - 바이너리는 존재하나 상태는 `inactive`
- `docker`
  - 현재 호스트에 미설치
  - `docker.service` unit 미확인
- `cloudflared`
  - 미설치
  - `cloudflared.service` unit 미확인
- `sshd`
  - 바이너리 및 `/etc/ssh/sshd_config` 미확인
  - `ssh.service` 또는 `sshd.service` unit 미확인

## Observations

- 현재 호스트는 목표 홈랩 서버보다는 일반 Ubuntu 워크스테이션 상태에 가깝다.
- GUI/desktop 계열 패키지와 사용자 앱 흔적이 존재하며, 서버 프로비저닝 전용 베이스 상태는 아니다.
- 스토리지 역할 자체는 최신 설계와 맞지만, 보조 SSD의 실제 마운트 포인트가 `/mnt/primary` 가 아니라 `/data` 다.
- ZFS 대상 HDD 중 기존 파일시스템이 확인되므로 `system/02_zfs_archive.sh`는 즉시 실행하면 안 된다.

## Blocking Items Before Layer 0 Storage Apply

- `PRIMARY_SSD_DISK`, `ZFS_DISK1`, `ZFS_DISK2` 운영값을 `.env` 에 확정해야 한다.
- 500GB SSD를 계속 `/data` 로 유지할지, `/mnt/primary` 로 마이그레이션할지 결정이 필요하다.
- 8TB HDD 기존 데이터 보존 여부를 결정하기 전에는 ZFS 초기화를 금지해야 한다.

## Actions Already Added To IaC

- 스토리지 host bind path를 환경 변수 기반으로 바꿨다.
- `system/00_preflight.sh` 를 추가해 보조 SSD 기존 마운트, ZFS 대상 디스크 기존 파일시스템, 주요 서비스 설치 상태를 비파괴 점검하도록 했다.
- `make storage` 전에 `make preflight` 가 자동 실행되도록 연결했다.

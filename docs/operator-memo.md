# Operator Memo

아래 항목은 자동으로 결정하면 위험하므로, 이번 작업에서는 메모로 남기고 건너뛴다.

## Human Decisions Needed

1. 500GB SSD 경로 정책
현재 호스트는 보조 SSD를 `/data` 에 마운트하고 있다. 목표 설계는 `/mnt/primary` 이다.
결정 필요:
- `/data` 를 유지하고 `.env` 의 `PRIMARY_STORAGE_ROOT=/data` 로 운영할지
- 데이터를 비운 뒤 `/mnt/primary` 로 재마운트할지

2. 8TB HDD 초기화 가능 여부
ZFS mirror 대상 중 최소 1개 디스크에 기존 `ntfs` 파티션이 있다.
결정 필요:
- 두 HDD를 모두 초기화해도 되는지
- 기존 데이터를 백업/이관한 뒤 진행할지

3. 대상 호스트 확정
현재 인벤토리는 Docker, Cloudflared, SSH 서버가 없는 일반 Ubuntu 환경으로 보인다.
결정 필요:
- 이 머신이 실제 홈랩 서버 본체가 맞는지
- 아니면 운영자 워크스테이션에서 저장소만 준비 중인 상태인지

## Safe Next Steps Without Human Input

- `.env` 템플릿과 Compose/스크립트를 계속 정리한다.
- preflight, inventory, 운영 문서를 보강한다.
- 실제 패키지 설치나 디스크 초기화 같은 destructive 작업은 보류한다.

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

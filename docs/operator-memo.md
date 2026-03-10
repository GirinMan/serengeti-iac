# Operator Memo

사용자 응답이 필요하지만 지금은 작업을 계속하기 위해 보류한 항목들이다.

## Storage Decisions

- 500GB SSD 현재 마운트는 `/data`다.
  - 선택지 1: IaC의 `PRIMARY_STORAGE_ROOT`를 `/data`로 채택
  - 선택지 2: 데이터를 비운 뒤 `/mnt/primary`로 재마운트
- 8TB HDD 중 적어도 1개에는 기존 NTFS 파티션이 있다.
  - ZFS mirror 초기화 전에 보존 여부를 확인해야 한다.

## Host Identity

- 현재 호스트에는 `openssh-server`, `docker`, `cloudflared`, `zfsutils-linux`가 보이지 않는다.
- 서버 최종 상태가 아닌 워크스테이션일 가능성이 있다.
- 실제 홈랩 서버가 다른 장비라면, 같은 인벤토리 수집을 그 장비에서 다시 실행해야 한다.

## Safe Next Actions

- `.env`에 실제 디스크 ID와 원하는 마운트 경로를 반영
- `make preflight` 실행
- 결과가 정리되면 그 다음 `make system`, `make storage` 순서로 진행

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

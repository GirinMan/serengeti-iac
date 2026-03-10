# Current Host Audit (2026-03-10)

이 문서는 2026-03-10 기준 현재 홈랩 서버 실측 상태를 마스킹해 요약한 결과다. 초기 인벤토리와 이후 적용 결과를 함께 반영했다.

## Host Summary

- OS: Ubuntu 24.04.4 LTS
- Kernel: `6.17.0-14-generic`
- Timezone: `Asia/Seoul`
- Active NIC: 단일 유선 인터페이스 1개
- Active subnet: `<server_private_subnet>`
- Default gateway: `<building_router_ip>`
- 대상 호스트: 실제 홈랩 서버 본체로 확인됨

## Storage Summary

- 1TB NVMe SSD
  - `/` 루트 디스크로 유지
  - Docker 엔진, 시스템 패키지, NPM 운영 레이어가 여기에 위치
- 500GB NVMe SSD
  - ext4로 포맷되어 `/mnt/primary` 에 마운트됨
  - `/data` bind/mount 정책은 제거됨
  - DB/캐시/덤프용 디렉토리 구조 생성 완료
- 8TB HDD x2
  - ZFS mirror 풀 `archive` 로 초기화됨
  - `/mnt/archive` 마운트 활성
  - Minio, Nextcloud data, Borg repo 배치 가능 상태

## Service Summary

- `ufw`
  - 활성 상태
  - `<room_router_wan_ip>` 전체 허용, `<server_private_subnet> -> 2222/tcp`, loopback 허용 규칙 적용
- `docker`
  - 설치 및 활성
  - Layer 1~3 컨테이너 스택 기동 기반 준비 완료
- `sshd`
  - 설치 및 활성
  - `2222/tcp` 단일 리스닝으로 정리
  - 공개키 인증 전용 설정 반영
- `cloudflared`
  - 패키지 설치 완료
  - Tunnel token 미입력 상태라 서비스 등록은 미완료

## Container Summary

- Healthy:
  - `npm`
  - `postgres`
  - `neo4j`
  - `elasticsearch`
  - `redis`
  - `kafka`
  - `minio`
  - `nextcloud`
- Recovery in progress:
  - `ghost-blog`
    - 커스텀 이미지 필요 사항은 IaC에 반영됨
    - fresh DB 마이그레이션 충돌 정리 후 재기동 필요
  - `backup-pipeline`
    - cron 런타임 재빌드 후 재기동 필요

## Observations

- Layer 0 스토리지 및 기본 보안 설정은 목표 설계에 가깝게 정렬됐다.
- 현재 남은 인간 개입 항목은 Cloudflare Tunnel 토큰 입력, 실제 도메인/공개 hostname 등록 같은 외부 서비스 작업이다.
- `/home/girinman/Downloads/onedrive` 는 보호 대상이며 이번 작업에서 접근/삭제하지 않았다.

## Remaining Manual Tasks

- Cloudflare Zero Trust Tunnel 생성 및 `CF_TUNNEL_TOKEN` 입력
- 실제 도메인 등록 및 DNS/hostname 연결
- 외부망 기준 최종 접근 검증

## IaC Changes Landed

- 스토리지 host bind path를 환경 변수 기반으로 정리했다.
- `make preflight`, `make storage-map` 으로 비파괴 점검 흐름을 추가했다.
- Ghost는 커스텀 이미지 + PostgreSQL 연결 기준으로 정리 중이다.
- Backup 파이프라인은 컨테이너 친화적인 cron 이미지 기준으로 정리 중이다.

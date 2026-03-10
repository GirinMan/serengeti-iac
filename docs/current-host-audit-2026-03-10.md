# Current Host Audit (2026-03-10)

이 문서는 2026-03-10에 수집한 원본 인벤토리와 실제 적용 결과를 마스킹해 요약한 결과다.

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
  - ext4로 포맷되어 `/mnt/primary` 에 마운트됨
  - 목표 설계의 `Primary Storage` 역할과 일치
- 8TB HDD x2
  - `archive` ZFS mirror 풀로 구성됨
  - `/mnt/archive` 활성 상태
  - `zfs-auto-snapshot` 설치 및 snapshot 정책 적용

## Service Summary

- `ufw`
  - 활성 상태
  - `LOCAL_GW` 전체 허용, `LOCAL_SUBNET -> 2222/tcp`, loopback 허용
- `docker`
  - 설치 완료
  - Layer 1~3 compose 스택 대부분 기동 중
- `cloudflared`
  - 패키지 설치 완료
  - 토큰 미입력 상태라 서비스 등록은 보류
- `sshd`
  - `openssh-server` 설치 및 활성화
  - `2222/tcp` 단일 포트 리슨
  - 공개키 인증 전용으로 구성

## Observations

- 현재 호스트는 실제 홈랩 서버 본체이며 Layer 0 기초 설정이 대부분 적용됐다.
- Docker 기반 Layer 1~2 서비스는 정상 기동했고, Layer 3에서는 Nextcloud가 healthy 상태다.
- 남은 앱 계층 이슈는 Ghost 초기 DB 마이그레이션 충돌과 backup 컨테이너 cron 런타임 재시작이다.
- `/home/girinman/Downloads/onedrive` 보호 원칙은 유지 중이며 작업 과정에서 건드리지 않았다.

## Open Items

- Cloudflare Tunnel 토큰과 실제 공인 도메인 값은 사람 입력이 필요하다.
- Ghost 블로그 DB는 새 DB 기준으로 리셋 후 재기동 검증이 필요하다.
- backup 컨테이너는 cron 구현 변경 후 재빌드/재검증이 필요하다.

## Actions Already Added To IaC

- 스토리지 host bind path를 환경 변수 기반으로 바꿨다.
- `system/00_preflight.sh` 를 추가해 보조 SSD 기존 마운트, ZFS 대상 디스크 기존 파일시스템, 주요 서비스 설치 상태를 비파괴 점검하도록 했다.
- `make storage` 전에 `make preflight` 가 자동 실행되도록 연결했다.
- Kafka는 공식 `apache/kafka` 이미지 기준으로 정리했다.
- Ghost는 PostgreSQL 드라이버를 포함한 커스텀 이미지를 사용하도록 전환했다.

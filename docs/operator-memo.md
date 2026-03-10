# Operator Memo

현재는 사람이 직접 해야 하는 외부 서비스 작업이나, 이번 세션의 도구 제약으로 인해 즉시 실행하지 못한 작업만 남긴다.

## Human Tasks Still Needed

1. Cloudflare Tunnel / Domain
- Cloudflare에서 tunnel 생성
- `CF_TUNNEL_TOKEN`을 로컬 `.env`에 입력
- 실제 공개 도메인과 hostname을 연결

2. 외부망 최종 검증
- Cloudflare Access를 통한 SSH 접근 확인
- 외부 네트워크에서 블로그/NAS/object storage 라우팅 확인

## Safe Next Steps Without Human Input

- Ghost fresh DB를 재초기화해 재기동
- Backup 파이프라인 이미지를 재빌드해 cron 컨테이너를 안정화
- 앱 레이어 runbook과 진행 로그를 계속 보강

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

## Temporary Memo

- 현재 실행 컨텍스트에서 Docker daemon 접근이 간헐적으로 거부되는 구간이 있었다.
- repo 수정과 정적 검증은 완료했고, 실제 컨테이너 재기동은 daemon 접근이 허용되는 즉시 이어서 진행한다.

# Operator Memo

아래 항목은 사람 입력이나 현재 세션 제약 때문에 자동 완료하지 못한 것들이다.

## Human Input Still Needed

1. Cloudflare Tunnel 등록
결정/입력 필요:
- 실제 `CF_TUNNEL_TOKEN`
- 실제 공인 도메인과 Cloudflare DNS 위임 완료 상태

2. Ghost 초기 DB 리셋 실행
현재 상태:
- `ghost-blog` 는 PostgreSQL 드라이버 누락 문제는 해결됨
- 다만 `ghost_blog` DB 초기 마이그레이션이 꼬여 `migrations_lock` 제약조건 충돌로 재시작 중
메모:
- 새로 만든 블로그 DB이므로 드롭 후 재생성이 가장 빠른 복구 경로다.
- 현재 세션에서는 Docker API 접근이 불안정해 실제 DB 리셋 명령 재검증이 보류됨

3. Backup 컨테이너 재빌드 확인
현재 상태:
- `backup-pipeline` 는 `setpgid: Operation not permitted` 로 재시작 중
- repo에서는 `busybox crond` 경로로 정리했다.
메모:
- 변경 후 `docker compose ... build --no-cache && up -d --force-recreate` 재확인이 필요하다.

## Safe Next Steps Without Human Input

- `.env` 템플릿과 Compose/스크립트를 계속 정리한다.
- preflight, inventory, 운영 문서를 보강한다.
- Docker API 접근이 허용되는 세션에서 Ghost/Backup 재기동 검증을 마저 수행한다.

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

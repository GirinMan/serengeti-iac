# Operator Memo

아래 항목은 사람 입력이나 현재 세션 제약 때문에 자동 완료하지 못한 것들이다.

## Human Input Still Needed

1. Cloudflare Tunnel 등록
결정/입력 필요:
- 실제 `CF_TUNNEL_TOKEN`
- 실제 공인 도메인과 Cloudflare DNS 위임 완료 상태

2. 런타임 재기동 검증
현재 상태:
- 현재 세션은 `sudo` 와 Docker daemon 접근이 막혀 있다.
- repo에는 `Directus + existing PostgreSQL` 재설계와 `backup` cron 수정이 반영됐다.
메모:
- 운영자 세션에서는 아래 순서로 재검증하면 된다.
- `docker exec -i postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE directus;"`
- `docker compose --env-file .env -f docker/layer3-apps/content/docker-compose.yml up -d`
- `docker compose --env-file .env -f docker/layer3-apps/backup/docker-compose.yml up -d --build --force-recreate`

## Safe Next Steps Without Human Input

- `.env` 템플릿과 Compose/스크립트를 계속 정리한다.
- preflight, inventory, 운영 문서를 보강한다.
- Docker API 접근이 허용되는 세션에서 Directus/Backup 재기동 검증을 마저 수행한다.

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

# Girinman API (Blog Guestbook Backend)

`blog.giraffe.ai.kr` 의 방명록/댓글 기능을 제공하는 FastAPI 백엔드.
소스와 Dockerfile 은 `girinman-career` 리포의 `api/` 디렉토리에 있고, IaC 는
Harbor 에 푸시된 이미지를 끌어다 띄우기만 한다.

- **URL**: `https://blog.giraffe.ai.kr/api/*` (Astro 정적 사이트와 동일 오리진, NPM 이 `/api/` 만 프록시)
- **소스 리포**: `github.com/GirinMan/girinman-career` 의 `api/`
- **이미지**: `harbor.giraffe.ai.kr/girinman/girinman-api:<git-sha>`
- **DB**: 공유 Postgres (`data-tier` 네트워크, DB `girinman_blog`, role `girinman_api`)

## 배포 흐름 (end-to-end)

1. `girinman-career` `api/**` 변경 → GitHub Actions 가 Harbor 에 `:<sha>` 태그로 push.
2. 빌드 성공 직후 `peter-evans/repository-dispatch@v3` 가 `serengeti-iac` 로
   `deploy-girinman-api` 이벤트를 쏜다 (`client-payload.tag` 포함).
3. `serengeti-iac/.github/workflows/deploy-apps.yml` 이 self-hosted runner 에서
   실행 → `.env` 의 `GIRINMAN_API_IMAGE_TAG` 을 새 sha 로 `sed -i` 하고
   `make girinman-api` 실행.
4. `make girinman-api` → `harbor-login` → `docker compose pull && up -d`.
5. 컨테이너 entrypoint 가 `alembic upgrade head` 로 스키마를 적용.

## 사전 준비 (1회, 수동)

### 1. 공유 Postgres 에 role + DB 생성

```bash
DB_PW=$(openssl rand -base64 32)
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres <<SQL
CREATE ROLE girinman_api WITH LOGIN PASSWORD '${DB_PW}';
CREATE DATABASE girinman_blog OWNER girinman_api;
GRANT ALL PRIVILEGES ON DATABASE girinman_blog TO girinman_api;
SQL
echo "GIRINMAN_DB_PASSWORD=${DB_PW}"   # 값을 .env 에 이식 후 스크롤백 삭제
```

확인:

```bash
docker exec postgres psql -U postgres -c "\du girinman_api"
docker exec postgres psql -U postgres -c "\l girinman_blog"
```

### 2. `.env` secret 등록

`.env` 에 아래 3개 키를 세팅 (`.env.example` 참고):

```
GIRINMAN_API_IMAGE_TAG=<git sha from girinman-career>
GIRINMAN_DB_PASSWORD=<step 1 과 동일한 값>
GIRINMAN_IP_HASH_SECRET=<openssl rand -base64 48>
```

주의:

- `GIRINMAN_DB_PASSWORD` 는 Postgres role 비밀번호와 **정확히 일치**해야 한다.
- `GIRINMAN_IP_HASH_SECRET` 은 rate-limit 용 ip_hash 의 솔트. 회전하면 기존 rate
  limit 추적은 끊기지만 악의적 회피용이 아니므로 감수 가능. 가능하면 동결 운영.
- dev (`girinman-career/docker-compose.dev.yml`) 값과 **반드시 다름**. dev 테스트
  데이터의 해시가 prod 로 유출되지 않도록.

### 3. NPM 프록시 설정

`blog.giraffe.ai.kr` 프록시 호스트 → Advanced → Custom Nginx Configuration 에
아래 location block 추가 (정적 Astro 사이트와 동일 오리진 유지).

```nginx
location /api/ {
    proxy_pass http://girinman-api:8000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    client_max_body_size 64k;
    proxy_read_timeout 30s;
    proxy_connect_timeout 5s;
    proxy_send_timeout 10s;

    # FastAPI CORSMiddleware 가 CORS 헤더를 직접 관리. NPM 기본값 제거.
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Credentials;
}
```

Save → Reload.

## 수동 배포

특정 sha 를 먼저 배포하고 싶다면:

```bash
# .env 의 GIRINMAN_API_IMAGE_TAG 를 원하는 sha 로 편집 후
make girinman-api
```

혹은 GitHub Actions 에서 `Deploy Apps` workflow 를 `workflow_dispatch`
로 돌리고 `app=girinman-api`, `tag=<sha>` 입력.

## 스모크 체크

```bash
curl -fsS https://blog.giraffe.ai.kr/api/health
# -> {"ok":true,"environment":"production"}

# 공개글 작성
curl -fsS -X POST https://blog.giraffe.ai.kr/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"body":"hello","is_private":false}'

# 목록 조회
curl -fsS https://blog.giraffe.ai.kr/api/posts | jq '.[0]'
```

## 운영 메모

- **로그**: `docker logs girinman-api -f`. Python `logging` INFO 가 stdout 으로.
- **DB 접속 (운영자)**: 공유 Postgres 를 바로 본다. `docker exec -it postgres
  psql -U postgres -d girinman_blog`. 외부에서 DataGrip 등으로 붙으려면 랩탑에서
  `ssh -N -L 5433:<postgres container ip>:5432 homelab` 터널.
- **Rate limit**: `slowapi` + in-memory store. 단일 인스턴스 가정. 수평 확장하려면
  Redis backend 로 교체 필요하나 현재 트래픽에선 과설계.
- **백업**: 공유 Postgres 전체 백업 정책을 그대로 따른다. `girinman_blog` DB 도
  자동 포함.
- **롤백**: `.env` 의 `GIRINMAN_API_IMAGE_TAG` 를 이전 sha 로 바꾸고
  `make girinman-api`. Alembic downgrade 가 필요하면 수동:
  `docker exec girinman-api alembic downgrade -1`.
- **보안 주의**:
  - PIN 은 argon2id hash 로만 저장. verify 는 timing-safe 비교.
  - CORS 는 `https://blog.giraffe.ai.kr` 외 허용하지 않는다. wildcard 금지
    (compose 의 `CORS_ORIGINS` 는 `CF_BLOG_HOST.CF_DOMAIN` 에서 합성).

## 추후 과제

- Harbor 이미지 빌드용 GitHub Actions workflow (`girinman-career` 측).
- Alembic migration 을 entrypoint 안이 아닌 별도 init job 으로 분리.
- 관리자 뷰 (soft-deleted 목록, ban IP) — `/api/admin/*` + 세션 인증.

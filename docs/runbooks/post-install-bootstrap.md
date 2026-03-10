# Post-Install Bootstrap Runbook

Layer 1~3가 기동된 뒤 수행하는 후속 초기화 절차다. 명령은 모두 리포지토리 루트에서 실행한다.

## 1. Pre-check

`.env`를 먼저 로드한다.

```bash
set -a
source ./.env
set +a
```

기본 상태를 확인한다.

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls | grep -E 'proxy-tier|data-tier'
```

## 2. Data Layer Health

데이터 계층 컨테이너가 모두 `healthy` 또는 최소한 `running` 상태인지 확인한다.

```bash
docker inspect --format '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  postgres neo4j redis elasticsearch kafka minio mariadb rabbitmq
```

## 3. Database Initialization

현재 기본 앱 구성에서 명시적 PostgreSQL 초기화가 필요한 애플리케이션 DB는 `plane`, `nextcloud` 다.

```bash
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='plane'" | grep -q 1 || \
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE plane;"

docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='nextcloud'" | grep -q 1 || \
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE nextcloud;"
```

`WordPress` 는 PostgreSQL 이 아니라 `MariaDB` 를 사용하므로 별도 PostgreSQL 초기화가 없다. MariaDB 쪽은 환경변수 기반 자동 초기화를 사용한다.

생성 결과를 확인한다.

```bash
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -c '\l'
docker exec -i mariadb mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" -e 'SHOW DATABASES;'
```

## 4. NPM Routing Setup

NPM Admin은 현재 compose 기준으로 loopback에만 노출된다.

- Admin URL: `http://127.0.0.1:${NPM_ADMIN_PORT}`
- Container: `npm`
- Upstream network: `proxy-tier`

Proxy Host를 아래처럼 등록한다.

- Domain: `${CF_BLOG_HOST}`
- Scheme: `http`
- Forward Hostname / IP: `wordpress-blog`
- Forward Port: `80`

- Domain: `${CF_PLANE_HOST}`
- Scheme: `http`
- Forward Hostname / IP: `plane-proxy`
- Forward Port: `80`

- Domain: `${CF_NAS_HOST}`
- Scheme: `http`
- Forward Hostname / IP: `nextcloud`
- Forward Port: `80`

- Domain: `${CF_S3_HOST}`
- Scheme: `http`
- Forward Hostname / IP: `minio`
- Forward Port: `${MINIO_CONSOLE_PORT}`

Cloudflare Tunnel과 공인 도메인 연결 전까지는 SSL 발급을 강제하지 않는다. 먼저 NPM 내부 라우팅과 upstream 응답만 검증한다.

선택형 콘텐츠 API가 필요하면 아래 항목도 추가한다.

- Domain: `${CF_CONTENT_HOST}`
- Scheme: `http`
- Forward Hostname / IP: `content-api`
- Forward Port: `${DIRECTUS_PORT}`

## 5. Blog Validation

현재 `docker/layer3-apps/blog/docker-compose.yml` 은 `wordpress-blog:80` 을 `proxy-tier` 와 `data-tier` 에 붙인다.

```bash
docker logs --tail 50 wordpress-blog
docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' wordpress-blog
docker exec wordpress-blog curl -fsS http://127.0.0.1/wp-json/
```

## 6. Plane Validation

현재 `docker/layer3-apps/plane/docker-compose.yml` 은 기존 `postgres`, `redis`, `minio` 를 재사용하고 `rabbitmq` 를 함께 사용한다.

```bash
docker logs --tail 50 plane-migrator
docker logs --tail 50 plane-api
docker logs --tail 50 plane-proxy
docker inspect --format '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  plane-api plane-worker plane-beat-worker plane-live plane-web plane-admin plane-space plane-proxy
docker exec plane-proxy curl -fsS http://127.0.0.1/
```

Plane 업로드를 쓰려면 `Minio` 쪽 버킷 `${PLANE_AWS_BUCKET_NAME}` 도 미리 만들어 둔다.

## 7. Optional Content API Validation

`Directus` 를 선택형 콘텐츠 API로 올릴 때만 수행한다.

```bash
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='${DIRECTUS_DB}'" | grep -q 1 || \
docker exec -i postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE ${DIRECTUS_DB};"
docker compose --env-file .env -f docker/layer3-apps/content/docker-compose.yml up -d
docker logs --tail 50 content-api
docker exec content-api wget -qO- "http://127.0.0.1:${DIRECTUS_PORT}/server/health"
```

## 8. Nextcloud Validation

현재 `docker/layer3-apps/nextcloud/docker-compose.yml`은 내부 HTTP `80` 포트를 사용한다.

```bash
docker logs --tail 50 nextcloud
docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nextcloud
docker exec nextcloud curl -fsS http://127.0.0.1/status.php
docker exec nextcloud php occ status
```

## 9. Minio Validation

현재 `docker/layer2-data/minio/docker-compose.yml`은 API 포트 `${MINIO_API_PORT}`, Console 포트 `${MINIO_CONSOLE_PORT}`를 컨테이너 내부에서 사용한다.

```bash
docker logs --tail 50 minio
docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' minio
docker exec minio curl -fsS "http://127.0.0.1:${MINIO_API_PORT}/minio/health/live"
docker exec minio curl -I "http://127.0.0.1:${MINIO_CONSOLE_PORT}"
```

## 10. Kafka Validation

현재 `docker/layer2-data/kafka/docker-compose.yml`은 `apache/kafka:${KAFKA_VERSION}`와 내부 broker 포트 `${KAFKA_BROKER_PORT}`를 사용한다.

토픽 목록과 테스트 토픽 생성을 검증한다.

```bash
docker logs --tail 50 kafka
docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' kafka
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server "127.0.0.1:${KAFKA_BROKER_PORT}" --list
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server "127.0.0.1:${KAFKA_BROKER_PORT}" --create --if-not-exists --topic bootstrap-check --partitions 1 --replication-factor 1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server "127.0.0.1:${KAFKA_BROKER_PORT}" --describe --topic bootstrap-check
```

## 11. Recommended Order

```bash
make ops
make data
make apps
make backup
```

그 다음 순서로 진행한다.

1. PostgreSQL `plane`, `nextcloud` DB 생성
2. MariaDB 초기화 상태 확인
3. NPM Proxy Host 등록
4. `WordPress`, `Plane`, `Nextcloud`, `Minio`, `Kafka` 개별 검증
5. 선택형이면 `Directus` 를 추가
6. Backup 파이프라인을 `--build`로 재기동 후 수동 덤프 검증

```bash
docker compose --env-file .env -f docker/layer3-apps/backup/docker-compose.yml build --no-cache
docker compose --env-file .env -f docker/layer3-apps/backup/docker-compose.yml up -d --force-recreate
docker logs --tail 50 backup-pipeline
```

# Post-Install Bootstrap Runbook

Layer 0~3 컨테이너가 올라온 뒤 수행하는 초기화 절차다.

## 1. Data Layer Health

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker inspect --format '{{.State.Health.Status}}' postgres
docker inspect --format '{{.State.Health.Status}}' neo4j
docker inspect --format '{{.State.Health.Status}}' redis
docker inspect --format '{{.State.Health.Status}}' elasticsearch
docker inspect --format '{{.State.Health.Status}}' kafka
docker inspect --format '{{.State.Health.Status}}' minio
```

## 2. PostgreSQL Database Init

```bash
docker exec -i postgres psql -U "${POSTGRES_USER}" -tc "SELECT 1 FROM pg_database WHERE datname='ghost_blog'" | grep -q 1 || \
  docker exec -i postgres psql -U "${POSTGRES_USER}" -c "CREATE DATABASE ghost_blog;"

docker exec -i postgres psql -U "${POSTGRES_USER}" -tc "SELECT 1 FROM pg_database WHERE datname='nextcloud'" | grep -q 1 || \
  docker exec -i postgres psql -U "${POSTGRES_USER}" -c "CREATE DATABASE nextcloud;"
```

## 3. NPM Routing

- Admin URL: `http://127.0.0.1:${NPM_ADMIN_PORT}`
- Proxy Host
  - `${CF_BLOG_HOST}` -> `ghost-blog:${GHOST_PORT}`
  - `${CF_NAS_HOST}` -> `nextcloud:80`
  - `${CF_S3_HOST}` -> `minio:${MINIO_CONSOLE_PORT}`
- SSL은 Cloudflare/도메인 준비 후 적용

## 4. Ghost Validation

```bash
docker logs --tail 50 ghost-blog
curl -I http://127.0.0.1:${GHOST_PORT}
```

## 5. Nextcloud Validation

```bash
docker logs --tail 50 nextcloud
curl -fsS http://127.0.0.1/status.php || docker exec nextcloud curl -fsS http://127.0.0.1/status.php
```

## 6. Minio Validation

```bash
docker logs --tail 50 minio
curl -fsS http://127.0.0.1:${MINIO_API_PORT}/minio/health/live
```

## 7. Kafka Validation

```bash
docker logs --tail 50 kafka
docker exec kafka kafka-topics.sh --bootstrap-server localhost:${KAFKA_BROKER_PORT} --list
docker exec kafka kafka-topics.sh --bootstrap-server localhost:${KAFKA_BROKER_PORT} --create --topic events --partitions 1 --replication-factor 1
docker exec kafka kafka-topics.sh --bootstrap-server localhost:${KAFKA_BROKER_PORT} --list
```

## 8. Backup Validation

```bash
docker exec backup-pipeline /scripts/dump_postgres.sh
docker exec backup-pipeline /scripts/run_borg.sh
ls -lah "${DUMPS_DIR}"
sudo borg list "${BORG_REPO_HOST_PATH}"
```

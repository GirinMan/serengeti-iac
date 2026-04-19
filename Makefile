-include .env
export

COMPOSE = docker compose --env-file .env
PRIMARY_STORAGE_ROOT ?= /mnt/primary
ARCHIVE_STORAGE_ROOT ?= /mnt/archive

.PHONY: help check-env validate preflight storage-map runtime-snapshot system storage ssh ufw cloudflared network dirs ops npm harbor harbor-login data apps blog girinman-api gis gis-init gis-migrate gis-status backup bootstrap app status logs docs-host clean

help:
	@echo "===== Serengeti Homelab IaC ====="
	@echo "make system      - Layer 0 시스템 기본 패키지 구성"
	@echo "make storage     - Layer 0 스토리지 구성"
	@echo "make ssh         - SSH 설정 템플릿 적용"
	@echo "make ufw         - UFW 방화벽 설정"
	@echo "make cloudflared - Cloudflare Tunnel 설치"
	@echo "make validate    - 주요 쉘 스크립트 문법 및 compose 설정 검증"
	@echo "make preflight   - 현재 호스트가 Layer 0 적용 가능한지 점검"
	@echo "make storage-map - 디스크 ID와 .env 후보값 출력"
	@echo "make runtime-snapshot - 현재 런타임 상태를 raw 로그로 저장"
	@echo "make network     - Docker 네트워크 생성"
	@echo "make dirs        - 로컬 bind mount 디렉토리 생성"
	@echo "make ops         - Layer 1 서비스 실행 (npm + harbor)"
	@echo "make npm         - Layer 1 Nginx Proxy Manager 실행"
	@echo "make harbor      - Layer 1 Harbor registry 실행"
	@echo "make data        - Layer 2 데이터 플랫폼 실행"
	@echo "make apps        - Layer 3 애플리케이션 실행"
	@echo "make backup      - 백업 파이프라인 실행"
	@echo "make bootstrap   - Layer 1~3 전체 스택 순차 실행"
	@echo "make gis-init    - GIS DB 생성 + 스키마 적용"
	@echo "make gis-migrate - 레거시 Shapefile → PostGIS 마이그레이션"
	@echo "make gis         - Layer 3 GIS 서비스 실행 (Harbor pull)"
	@echo "make blog        - Layer 3 Blog 실행 (Harbor pull)"
	@echo "make girinman-api - Layer 3 Girinman API (blog 방명록 백엔드) 실행 (Harbor pull)"
	@echo "make gis-status  - GIS 서비스 상태 점검"
	@echo "make harbor-login - Harbor registry 로그인 (push/pull 전 필요)"
	@echo "make app name=<blog|girinman-api|nextcloud|plane|gis> - 개별 앱 재배포"
	@echo "make docs-host   - 현재 호스트 상태 수집 문서 생성"
	@echo "make status      - 전체 상태 확인"
	@echo "make logs name=<container> - 컨테이너 로그 확인"
	@echo "make clean       - 전체 스택 중단"

check-env:
	@if [ ! -f .env ]; then \
		echo ".env 파일이 없습니다. cp .env.example .env 후 값을 채우세요."; \
		exit 1; \
	fi

validate: check-env
	@echo "==> 쉘 스크립트 문법 확인"
	bash -n system/00_preflight.sh
	bash -n system/lib_env.sh
	bash -n system/01_setup.sh
	bash -n system/02_zfs_archive.sh
	bash -n system/03_mount_primary.sh
	bash -n system/ufw.sh
	bash -n system/cloudflared_install.sh
	bash -n docker/networks.sh
	bash -n docker/layer3-apps/backup/scripts/dump_postgres.sh
	bash -n docker/layer3-apps/backup/scripts/dump_neo4j.sh
	bash -n docker/layer3-apps/backup/scripts/run_borg.sh
	bash -n scripts/collect_host_state.sh
	bash -n scripts/storage_env_candidates.sh
	bash -n scripts/runtime_snapshot.sh
	bash -n docker/layer3-apps/gis/init-gisdb.sh
	bash -n docker/layer3-apps/gis/migrate-legacy.sh
	bash -n docker/layer3-apps/gis/gis-status.sh
	@if command -v docker >/dev/null 2>&1; then \
		echo "==> Docker Compose 설정 확인"; \
		$(COMPOSE) -f docker/layer1-ops/npm/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer1-ops/harbor/docker-compose.yml config >/dev/null || echo "(harbor compose 검증 실패: prepare 이후에만 성공)"; \
		$(COMPOSE) -f docker/layer2-data/postgres/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/neo4j/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/elasticsearch/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/redis/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/kafka/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/minio/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer2-data/rabbitmq/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/nextcloud/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/plane/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/backup/docker-compose.yml config >/dev/null; \
		$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml config >/dev/null; \
	else \
		echo "==> Docker가 없어 Compose 검증은 건너뜁니다."; \
	fi

preflight: check-env
	@echo "==> Layer 0 사전 점검"
	bash system/00_preflight.sh

storage-map:
	@echo "==> 스토리지 후보값 수집"
	bash scripts/storage_env_candidates.sh

runtime-snapshot:
	@echo "==> 현재 런타임 상태 수집"
	bash scripts/runtime_snapshot.sh

dirs:
	@echo "==> 로컬 bind mount 디렉토리 생성"
	mkdir -p docker/layer1-ops/npm/data
	mkdir -p docker/layer1-ops/npm/letsencrypt
	@# Harbor data/** dirs are created by docker/layer1-ops/harbor/README.md bootstrap (prepare step sets correct container UIDs). Do not pre-create here.
	mkdir -p $(PRIMARY_STORAGE_ROOT)/rabbitmq
	mkdir -p $(PRIMARY_STORAGE_ROOT)/plane/logs/api
	mkdir -p $(PRIMARY_STORAGE_ROOT)/plane/logs/worker
	mkdir -p $(PRIMARY_STORAGE_ROOT)/plane/logs/beat
	mkdir -p $(PRIMARY_STORAGE_ROOT)/plane/logs/migrator
	mkdir -p $(ARCHIVE_STORAGE_ROOT)/astro-blog/dist
	mkdir -p docker/layer3-apps/nextcloud/html
	mkdir -p docs/raw
	mkdir -p /tmp/gis-worker

system:
	@echo "==> [Layer 0] 시스템 기초 설정"
	bash system/01_setup.sh

storage: check-env preflight
	@echo "==> [Layer 0] 스토리지 구성"
	bash system/02_zfs_archive.sh
	bash system/03_mount_primary.sh

ssh: check-env
	@echo "==> [Layer 0] SSH 설정 적용"
	sed \
		-e "s/__SSH_PORT__/$(SSH_PORT)/g" \
		-e "s/__SSH_USER__/$(SSH_USER)/g" \
		system/sshd_config | sudo tee /etc/ssh/sshd_config >/dev/null
	-sudo systemctl restart ssh.service
	@echo "SSH Port: $(SSH_PORT)"

ufw: check-env
	@echo "==> [Layer 0] UFW 방화벽 설정"
	sudo bash system/ufw.sh

cloudflared: check-env
	@echo "==> [Layer 1] Cloudflare Tunnel 설치"
	bash system/cloudflared_install.sh

network:
	@echo "==> Docker 네트워크 생성"
	bash docker/networks.sh

ops: check-env network dirs npm harbor
	@echo "==> [Layer 1] ops 스택 기동 완료"

npm: check-env network dirs
	@echo "==> [Layer 1] Nginx Proxy Manager 실행"
	$(COMPOSE) -f docker/layer1-ops/npm/docker-compose.yml up -d

harbor: check-env network dirs
	@echo "==> [Layer 1] Harbor registry 실행"
	@if [ ! -d docker/layer1-ops/harbor/common/config ]; then \
		echo "Harbor common/config 가 없습니다. README의 bootstrap 순서대로 prepare 를 먼저 실행하세요."; \
		exit 1; \
	fi
	$(COMPOSE) -f docker/layer1-ops/harbor/docker-compose.yml up -d

data: check-env network
	@echo "==> [Layer 2] 데이터 플랫폼 실행"
	$(COMPOSE) -f docker/layer2-data/postgres/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/neo4j/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/elasticsearch/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/redis/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/kafka/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/minio/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer2-data/rabbitmq/docker-compose.yml up -d

harbor-login: check-env
	@HARBOR_CLI_USER=$$(grep -E '^HARBOR_CLI_USER=' ./.env | cut -d= -f2-); \
	HARBOR_CLI_PASSWORD=$$(grep -E '^HARBOR_CLI_PASSWORD=' ./.env | cut -d= -f2-); \
	CF_HARBOR_HOST=$$(grep -E '^CF_HARBOR_HOST=' ./.env | cut -d= -f2-); \
	if [ -z "$$HARBOR_CLI_USER" ] || [ -z "$$HARBOR_CLI_PASSWORD" ] || [ -z "$$CF_HARBOR_HOST" ]; then \
		echo "HARBOR_CLI_USER / HARBOR_CLI_PASSWORD / CF_HARBOR_HOST 가 .env 에 설정되어 있어야 합니다."; \
		exit 1; \
	fi; \
	echo "$$HARBOR_CLI_PASSWORD" | docker login "$$CF_HARBOR_HOST" -u "$$HARBOR_CLI_USER" --password-stdin

apps: check-env network dirs harbor-login
	@echo "==> [Layer 3] 애플리케이션 실행"
	$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml pull
	$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml up -d
	@docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='girinman_api'" | grep -q 1 || { \
		echo "girinman_api role/db 가 없어 girinman-api 기동을 건너뜁니다. docker/layer3-apps/girinman-api/README.md §사전 준비 참고."; \
		SKIP_GIRINMAN_API=1; \
	}; \
	if [ -z "$${SKIP_GIRINMAN_API:-}" ]; then \
		$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml pull; \
		$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml up -d; \
	fi
	docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$(PLANE_DB_NAME)'" | grep -q 1 || \
		docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -c "CREATE DATABASE $(PLANE_DB_NAME);"
	$(COMPOSE) -f docker/layer3-apps/nextcloud/docker-compose.yml up -d
	$(COMPOSE) -f docker/layer3-apps/plane/docker-compose.yml up -d

blog: check-env network harbor-login
	@echo "==> [Layer 3] Blog 서비스 실행 (Harbor pull)"
	$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml pull
	$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml up -d

girinman-api: check-env network harbor-login
	@echo "==> [Layer 3] Girinman API 서비스 실행 (Harbor pull)"
	@docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='girinman_api'" | grep -q 1 || { \
		echo "ERROR: girinman_api role 이 없습니다. docker/layer3-apps/girinman-api/README.md §사전 준비 1 의 SQL 을 먼저 실행하세요."; \
		exit 1; \
	}
	$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml pull
	$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml up -d

gis-init: check-env
	@echo "==> [Layer 3] GIS DB 초기화"
	bash docker/layer3-apps/gis/init-gisdb.sh

gis-migrate: check-env gis-init
	@echo "==> [Layer 3] 레거시 데이터 마이그레이션"
	bash docker/layer3-apps/gis/migrate-legacy.sh

gis: check-env network harbor-login gis-init
	@echo "==> [Layer 3] GIS 서비스 실행 (Harbor pull)"
	$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml pull
	$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml up -d

gis-status:
	@echo "==> [Layer 3] GIS 서비스 상태 점검"
	bash docker/layer3-apps/gis/gis-status.sh

backup: check-env network
	@echo "==> [Layer 3] 백업 파이프라인 실행"
	$(COMPOSE) -f docker/layer3-apps/backup/docker-compose.yml up -d --build

bootstrap: ops data apps backup
	@echo "==> 전체 스택 기동 완료"

app: check-env
	@if [ -z "$(name)" ]; then \
		echo "사용법: make app name=<blog|girinman-api|nextcloud|plane|gis>"; \
		exit 1; \
	fi
	@if [ "$(name)" = "blog" ]; then \
		$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml pull; \
		$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml up -d --force-recreate; \
	elif [ "$(name)" = "girinman-api" ]; then \
		docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='girinman_api'" | grep -q 1 || { \
			echo "ERROR: girinman_api role 이 없습니다. docker/layer3-apps/girinman-api/README.md §사전 준비 1 의 SQL 을 먼저 실행하세요."; \
			exit 1; \
		}; \
		$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml pull; \
		$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml up -d --force-recreate; \
	elif [ "$(name)" = "nextcloud" ]; then \
		$(COMPOSE) -f docker/layer3-apps/nextcloud/docker-compose.yml up -d --force-recreate; \
	elif [ "$(name)" = "plane" ]; then \
		docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$(PLANE_DB_NAME)'" | grep -q 1 || \
			docker exec -i postgres psql -U "$(POSTGRES_USER)" -d postgres -c "CREATE DATABASE $(PLANE_DB_NAME);"; \
		$(COMPOSE) -f docker/layer3-apps/plane/docker-compose.yml up -d --force-recreate; \
	elif [ "$(name)" = "gis" ]; then \
		bash docker/layer3-apps/gis/init-gisdb.sh; \
		$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml pull; \
		$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml up -d --force-recreate; \
	else \
		echo "지원하지 않는 앱입니다: $(name)"; \
		exit 1; \
	fi

status:
	@echo "=== Docker Networks ==="
	@docker network ls | grep -E "proxy-tier|data-tier" || true
	@echo
	@echo "=== Running Containers ==="
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo
	@echo "=== Storage Usage ==="
	@df -h $(PRIMARY_STORAGE_ROOT) $(ARCHIVE_STORAGE_ROOT) 2>/dev/null || true

logs:
	@if [ -z "$(name)" ]; then \
		echo "사용법: make logs name=<container_name>"; \
		exit 1; \
	fi
	docker logs -f $(name)

docs-host:
	@echo "==> 현재 호스트 상태 수집"
	bash scripts/collect_host_state.sh

clean:
	@echo "==> 모든 컨테이너 중단"
	-$(COMPOSE) -f docker/layer3-apps/backup/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer3-apps/gis/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer3-apps/plane/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer3-apps/nextcloud/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer3-apps/girinman-api/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer3-apps/blog/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/rabbitmq/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/minio/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/kafka/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/redis/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/elasticsearch/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/neo4j/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer2-data/postgres/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer1-ops/harbor/docker-compose.yml down --remove-orphans
	-$(COMPOSE) -f docker/layer1-ops/npm/docker-compose.yml down --remove-orphans

# Operator Memo

사람 입력이 필요해 남겨 둔 항목만 적는다. 나머지는 가능한 범위에서 계속 자동 진행한다.

## Human Input Still Needed

1. ~~**gis-worker CI 413 (Cloudflare 100MB cap) — Self-hosted runner 필요**~~ *(해결 2026-04-16)*
   - Self-hosted runner 가 homelab 호스트에 등록됨 (`gha-runner` user, systemd 서비스).
   - `build-gis.yml` 의 `gis-worker` job 은 `runs-on: [self-hosted, linux, x64, homelab]` + buildx `driver-opts: network=host` + `localhost:8088` push 로 CF 우회 (run `24469753702` 에서 green 확인).
   - 설치 스크립트: `system/gha_runner_install.sh` (재등록 필요 시 참고).

2. ~~**IaC repo 용 self-hosted runner 추가 등록 + IaC 디렉토리 접근 권한 부여**~~ *(해결 2026-04-16)*
   - `gha-runner-iac` user 로 homelab 호스트에 등록 완료, `/home/girinman/workspace/serengeti-iac` 에 ACL rwX 부여, 상위 디렉토리에는 x 권한만 부여.
   - `deploy-apps.yml` 이 `runs-on: [self-hosted, linux, x64, homelab]` 로 전환, `git fetch https://.../main` + `git reset --hard FETCH_HEAD` + `make <app>` 흐름으로 SSH 우회.
   - 최근 실행에서 `gis` 파이프라인 `repository_dispatch` 수신 → 이미지 태그 `.env` 에 반영 → `make gis` 재기동까지 green 확인됨 (`.env` 의 `GIS_*_IMAGE_TAG=bb5757f...` 가 그 결과).

3. Cloudflare Tunnel 등록
   - 필요 값:
     - 실제 `CF_TUNNEL_TOKEN`
     - 실제 공인 도메인과 Cloudflare DNS 위임 상태
   - 이 값이 들어오기 전까지는 패키지 설치, NPM upstream, 내부 앱 기동까지만 진행한다.

3. 공인 도메인 라우팅 연결
   - NPM upstream 대상은 정리 가능하지만 실제 외부 라우팅 검증은 도메인 연결 후 마무리해야 한다.
   - 예정 호스트:
     - `${CF_BLOG_HOST}` -> `astro-blog:80` (정적 사이트)
     - `${CF_PLANE_HOST}` -> `plane-proxy:80`
     - `${CF_NAS_HOST}` -> `nextcloud:80`
     - `${CF_S3_HOST}` -> `minio:${MINIO_CONSOLE_PORT}`

## Runtime Notes

- **2026-04-16 현재 상태**:
  - Layer 1 (Ops): `npm`, `harbor-*` 전부 healthy ✓
  - Layer 2 (Data): `postgres`, `neo4j`, `elasticsearch`, `redis`, `kafka`, `minio`, `rabbitmq` - 모두 healthy ✓
  - Layer 3 (Apps):
    - `astro-blog` → Harbor 이미지 `harbor.giraffe.ai.kr/girinman/astro-blog:7fcfcfa5...` 로 교체 완료, healthy ✓. 과거 로컬 `astro-blog:1.0.1` 컨테이너는 제거.
    - `gis-api/gis-web/gis-worker` → Harbor 이미지 `:bb5757f3...` 로 가동, 모두 healthy ✓.
    - `plane-*`, `nextcloud` - 기존 상태 유지, healthy ✓.
  - Blog healthcheck: compose 내부 `wget`이 `localhost` → IPv6(::1) 먼저 시도해 실패하던 문제를 `http://127.0.0.1/` 로 변경해 해결.
- **2026-03-22 현재 상태** (14:00 UTC):
  - Layer 2 (Data): `postgres`, `neo4j`, `elasticsearch`, `redis`, `kafka`, `minio`, `rabbitmq` - 모두 healthy ✓
  - Layer 3 (Apps):
    - `npm` - healthy ✓
    - `plane-*` (전체 스택) - healthy ✓
    - `nextcloud` - **healthy** ✓ (권한 문제 해결 완료)
    - `wordpress-blog`, `mariadb` - 중단 완료 ✓
    - `astro-blog` - 아직 시작 안 함 (사전 준비 필요)
- 처리 완료 메모:
  - Plane 이미지 pull 중 일부 blob가 Docker Hub IPv6 경로에서 끊겼지만 개별 pull 재시도로 회복했다.
  - `minio` 는 고정 태그로 재기동했고 `plane-uploads` 버킷까지 생성했다.
  - 2026-03-22 13:50 UTC:
    - WordPress → Astro 마이그레이션: 코드 완료, wordpress/mariadb 컨테이너 중단 완료
    - Nextcloud unhealthy 원인 파악: 권한 문제
  - 2026-03-22 14:00 UTC:
    - **Nextcloud 복구 완료** ✓
    - 실제 원인: `/var/www/html` 전체 (마운트된 ./html 디렉토리)가 www-data 소유 필요
    - 해결: `docker exec nextcloud chown -R www-data:www-data /var/www/html`
    - 데이터 디렉토리(`/mnt/archive/nextcloud`)도 33:33 적용 완료

## Architecture Notes

- **2026-03-22 업데이트**: 기본 블로그를 `WordPress` 에서 `Astro` 정적 사이트로 마이그레이션했다.
  - Astro는 DB가 필요 없고 nginx로 정적 파일만 서빙한다.
  - `MariaDB` 는 더 이상 필요하지 않아 제거했다.
- `Plane` 은 task 관리용 애플리케이션으로 추가됐다.
- 현재 인프라 레이어 구성:
  - `PostgreSQL` - Nextcloud + Plane 용
  - `RabbitMQ` - Plane 용
  - `Redis` - Nextcloud + Plane 용
  - 나머지 데이터 플랫폼은 향후 확장 대비

## Safe Next Steps Without Human Input

- ~~Plane 이미지 pull을 끝내고 compose 전체를 재기동한다.~~ ✓ 완료
- `make runtime-snapshot` 으로 중간 상태 raw 로그를 계속 남긴다.
- post-install runbook, host audit, progress log를 현재 상태에 맞게 계속 갱신한다.
- WordPress → Astro 마이그레이션 진행 중:
  - WordPress, MariaDB 컨테이너 중단 완료
  - Astro 소스 디렉토리 초기화 필요 (사람이 직접 또는 추후 자동화)
  - 배포 디렉토리 생성 필요: `sudo mkdir -p /mnt/archive/astro-blog/dist && sudo chown -R $USER:$USER /mnt/archive/astro-blog`

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

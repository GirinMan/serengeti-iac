# Operator Memo

사람 입력이 필요해 남겨 둔 항목만 적는다. 나머지는 가능한 범위에서 계속 자동 진행한다.

## Human Input Still Needed

1. **girinman-career `IAC_DISPATCH_TOKEN` 재발급** *(2026-04-16 관찰)*
   - 증상: `build-blog.yml` 의 `Trigger IaC deploy` 단계가 `##[error]Bad credentials` 로 실패한다. Build+Harbor push 까지는 녹색.
   - 시크릿은 `gh secret list -R GirinMan/girinman-career` 로 `IAC_DISPATCH_TOKEN` 존재 자체는 확인되지만 GitHub API 가 자격 증명 자체를 거부하는 상태.
   - 대응: 새로 **Classic PAT (scope=`repo`)** 또는 `serengeti-iac` 리포에 대해 **Fine-grained PAT (Contents: Read+Write, Metadata: Read)** 를 발급해 `IAC_DISPATCH_TOKEN` 으로 덮어쓰기.
   - 검증: `website/**` 을 살짝 바꿔 push → run 이 녹색 (Trigger IaC deploy 포함) → IaC 쪽 `deploy-apps.yml` 이 `repository_dispatch` 이벤트로 자동 실행되어야 한다.
   - 참고: IaC 수신 경로는 2026-04-16 수동 `workflow_dispatch` (`tag=091b449b...`) 로 end-to-end 녹색 확인 완료.

2. ~~**gis-worker CI 413 (Cloudflare 100MB cap) — Self-hosted runner 필요**~~ *(해결 2026-04-16)*
   - Self-hosted runner 가 homelab 호스트에 등록됨 (`gha-runner` user, systemd 서비스).
   - `build-gis.yml` 의 `gis-worker` job 은 `runs-on: [self-hosted, linux, x64, homelab]` + buildx `driver-opts: network=host` + `localhost:8088` push 로 CF 우회 (run `24469753702` 에서 green 확인).
   - 설치 스크립트: `system/gha_runner_install.sh` (재등록 필요 시 참고).

2. ~~**IaC repo 용 self-hosted runner 추가 등록 + IaC 디렉토리 접근 권한 부여**~~ *(해결 2026-04-16)*
   - `gha-runner-iac` user 로 homelab 호스트에 등록 완료, `/home/girinman/workspace/serengeti-iac` 에 ACL rwX 부여, 상위 디렉토리에는 x 권한만 부여.
   - `deploy-apps.yml` 이 `runs-on: [self-hosted, linux, x64, homelab]` 로 전환, `git fetch https://.../main` + `git reset --hard FETCH_HEAD` + `make <app>` 흐름으로 SSH 우회.
   - 최근 실행에서 `gis` 파이프라인 `repository_dispatch` 수신 → 이미지 태그 `.env` 에 반영 → `make gis` 재기동까지 green 확인됨 (`.env` 의 `GIS_*_IMAGE_TAG=bb5757f...` 가 그 결과).

3. ~~Cloudflare Tunnel 등록 / 공인 도메인 라우팅~~ *(해결 2026-04-16 확인)*
   - `.env` 에 실제 `CF_TUNNEL_TOKEN`, `CF_DOMAIN=giraffe.ai.kr` 설정 완료.
   - 공개 호스트 상태 (2026-04-16 HTTPS probe):
     - `blog.giraffe.ai.kr` → `astro-blog:80`        200
     - `nas.giraffe.ai.kr` → `nextcloud:80`          200
     - `todo.giraffe.ai.kr` → `plane-proxy:80`       200
     - `minio.giraffe.ai.kr` → `minio:9001` (콘솔)    200
     - `s3.giraffe.ai.kr` → `minio:9000` (API)        403 (정상 — 인증 없이 list 금지)
     - `harbor.giraffe.ai.kr` → `harbor-nginx:8080`  200
     - `gis.giraffe.ai.kr` → `gis-web:80`             200

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
- ~~WordPress → Astro 마이그레이션~~ ✓ 완료 (girinman-career 리포 이관 + Harbor 이미지 기반 배포)
- `make runtime-snapshot` 으로 중간 상태 raw 로그를 계속 남긴다.
- post-install runbook, host audit, progress log를 현재 상태에 맞게 계속 갱신한다.
- 블로그 end-to-end 체인 (girinman-career push → build-blog.yml → Harbor → notify-iac → deploy-apps.yml → `make blog`) 실제 동작은 girinman-career 쪽에서 push 가 발생할 때 자연 검증된다 (인프라 측 구성은 이미 완비).

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

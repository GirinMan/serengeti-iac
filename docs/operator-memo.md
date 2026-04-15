# Operator Memo

사람 입력이 필요해 남겨 둔 항목만 적는다. 나머지는 가능한 범위에서 계속 자동 진행한다.

## Human Input Still Needed

1. **gis-worker CI 413 (Cloudflare 100MB cap) — Self-hosted runner 필요** *(2026-04-15 기록)*
   - 증상: `build-gis.yml`의 `gis-worker` job에서 `docker push harbor.giraffe.ai.kr/girinman/gis-worker:<sha>` 실행 시 postgis/postgis:16-3.4-alpine 기반 runtime 레이어가 ~269MB라 CF free-tier의 request body 100MB 제한에 걸려 `413 Payload Too Large` 발생. gis-api·gis-web·blog 은 multi-stage + layer split 으로 모두 100MB 미만으로 만들어 성공.
   - 임시 조치: 현재 commit `732eb80` 이미지는 homelab 호스트에서 `localhost:8088`(CF 우회)로 직접 `docker buildx build --push` 수행하여 Harbor 에 적재 완료. 배포(`make gis`)는 가능.
   - 왜 priming 만으로 안 되는가: CI 빌드가 재현 가능한 동일 digest 를 만들지 않는다. Base tag `postgis:16-3.4-alpine` 이 moving tag 여서 pull 시점마다 resolved digest 가 달라질 수 있고, buildx 의 provenance/attestation 설정 차이로 export 결과가 달라짐. 따라서 내가 push 한 269MB blob digest 와 CI 가 만든 digest 가 매칭되지 않아 HEAD-check skip 이 동작 안 함.
   - 해결안 (사람 입력 필요):
     - (A) **GitHub Actions self-hosted runner** 를 homelab 호스트에 등록. `gis-worker` job 만 `runs-on: [self-hosted, linux, x64]` 로 옮기고 push 는 `localhost:8088` (또는 `127.0.0.1` hosts override) 사용. GH PAT/registration token 필요.
     - (B) Base image digest pinning (`FROM postgis/postgis@sha256:<digest>`) + buildx provenance 끄기로 reproducibility 확보 후 priming. 실험적이고, apk mirror 갱신으로 여전히 digest 가 틀어질 수 있음.
   - 추천: (A). 등록 스크립트는 `system/gha_runner_install.sh` 에 이미 준비해 둠. 사람이 할 일: GitHub `GirinMan/GIS-underground-facilities` 저장소 Settings → Actions → Runners → "New self-hosted runner" 에서 **registration token** 복사 후 아래 실행:
     ```bash
     export GHA_REPO=GirinMan/GIS-underground-facilities
     export GHA_REG_TOKEN=<paste token>
     bash system/gha_runner_install.sh
     ```
     이후 `.github/workflows/build-gis.yml` 의 `gis-worker` job 의 `runs-on` 을 `[self-hosted, linux, x64, homelab]` 로 바꾸는 PR 을 다음 라운드에서 낼 예정.

2. Cloudflare Tunnel 등록
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

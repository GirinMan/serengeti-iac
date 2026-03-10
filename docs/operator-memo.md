# Operator Memo

사람 입력이 필요해 남겨 둔 항목만 적는다. 나머지는 가능한 범위에서 계속 자동 진행한다.

## Human Input Still Needed

1. Cloudflare Tunnel 등록
- 필요 값:
  - 실제 `CF_TUNNEL_TOKEN`
  - 실제 공인 도메인과 Cloudflare DNS 위임 상태
- 이 값이 들어오기 전까지는 패키지 설치, NPM upstream, 내부 앱 기동까지만 진행한다.

2. 공인 도메인 라우팅 연결
- NPM upstream 대상은 정리 가능하지만 실제 외부 라우팅 검증은 도메인 연결 후 마무리해야 한다.
- 예정 호스트:
  - `${CF_BLOG_HOST}` -> `wordpress-blog:80`
  - `${CF_PLANE_HOST}` -> `plane-proxy:80`
  - `${CF_NAS_HOST}` -> `nextcloud:80`
  - `${CF_S3_HOST}` -> `minio:${MINIO_CONSOLE_PORT}`

## Runtime Notes

- 현재 healthy:
  - `postgres`, `neo4j`, `elasticsearch`, `redis`, `kafka`, `minio`
  - `mariadb`, `rabbitmq`
  - `nextcloud`, `wordpress-blog`, `npm`
  - `plane-proxy`, `plane-admin`, `plane-web`, `plane-space`
- 처리 완료 메모:
  - Plane 이미지 pull 중 일부 blob가 Docker Hub IPv6 경로에서 끊겼지만 개별 pull 재시도로 회복했다.
  - `minio` 는 고정 태그로 재기동했고 `plane-uploads` 버킷까지 생성했다.

## Architecture Notes

- 기본 블로그는 `WordPress` 다.
- `Plane` 은 task 관리용 애플리케이션으로 추가됐다.
- `Directus` 는 기본 앱이 아니라 선택형 콘텐츠 API 후보로만 유지한다.
- 승인되지 않은 서비스 전용 DB 추가는 피했고, 실제 필요한 것만 인프라 레이어에 올렸다.
  - `WordPress` 용 `MariaDB`
  - `Plane` 용 `RabbitMQ`

## Safe Next Steps Without Human Input

- Plane 이미지 pull을 끝내고 compose 전체를 재기동한다.
- `make runtime-snapshot` 으로 중간 상태 raw 로그를 계속 남긴다.
- post-install runbook, host audit, progress log를 현재 상태에 맞게 계속 갱신한다.

## Protected Data

- `/home/girinman/Downloads/onedrive` 아래 데이터는 매우 중요하다.
- 어떤 자동화, 정리, 마이그레이션, 삭제 작업에서도 이 경로를 건드리면 안 된다.

# GIS 지하시설물 관리 시스템

하수도 정보 관리 시스템 - 지하 시설물 GIS 시각화 서비스

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  gis-web (nginx)           Port 80 (Cloudflare Tunnel)      │
│  ├── /          → React SPA (MapLibre GL JS)                │
│  ├── /api/      → gis-api (FastAPI)                         │
│  ├── /tiles/    → pg-tileserv (MVT)      [nginx 캐싱]       │
│  └── /features/ → pg-featureserv (OGC)                      │
├─────────────────────────────────────────────────────────────┤
│  gis-api (FastAPI)         Port 8000                         │
│  ├── PostgreSQL + PostGIS  (비동기 SQLAlchemy + GeoAlchemy2) │
│  ├── Redis                 (캐싱, TTL 1h)                    │
│  ├── Elasticsearch + nori  (주소 검색)                       │
│  ├── MinIO                 (파일 업로드)                     │
│  └── Kafka                 (수집 이벤트 발행)                │
├─────────────────────────────────────────────────────────────┤
│  gis-worker                Kafka Consumer                    │
│  ├── shp2pgsql / ogr2ogr   (Shapefile/GeoJSON 임포트)       │
│  └── 스테이징 → gis 스키마  (자동 좌표 변환)                 │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 16 + PostGIS 3.4                                 │
│  ├── gis.*     (regions, parcels, buildings, facilities ...) │
│  ├── auth.*    (users)                                       │
│  └── audit.*   (data_imports)                                │
└─────────────────────────────────────────────────────────────┘
```

## 서비스 구성

| 서비스 | 이미지 | 설명 |
|--------|--------|------|
| `pg-tileserv` | pramsey/pg_tileserv | PostGIS → MVT 벡터 타일 서빙 |
| `pg-featureserv` | pramsey/pg_featureserv | PostGIS → OGC API Features |
| `gis-api` | python:3.12-slim (빌드) | FastAPI 백엔드 API |
| `gis-worker` | postgis:16-3.4-alpine (빌드) | Kafka 데이터 수집 워커 |
| `gis-web` | node:22-alpine → nginx:alpine | React SPA + 리버스 프록시 |

## 사전 요구사항

serengeti-iac Layer 2 데이터 플랫폼이 실행 중이어야 합니다:

```bash
make data   # PostgreSQL, Redis, Elasticsearch, Kafka, MinIO 실행
```

## 배포 절차

### 1. GIS DB 초기화

```bash
make gis-init
```

`gisdb` 데이터베이스를 생성하고 스키마(gis/auth/audit)와 테이블 8개를 적용합니다.

- `initdb/01_extensions.sql` - PostGIS + topology 확장
- `initdb/02_schemas.sql` - gis, auth, audit 스키마
- `initdb/03_tables.sql` - 8개 테이블 + 13개 공간 인덱스
- `initdb/04_seed.sql` - 시설물 유형 7개 + 관리자 계정
- `initdb/05_functions.sql` - pg_tileserv용 MVT 함수 3개

### 2. 레거시 데이터 마이그레이션 (선택)

포천시 Shapefile 데이터가 있는 경우:

```bash
make gis-migrate
```

- `migration/06_seed_pocheon.sql` - 포천시 지역 등록
- `migration/07_migrate_parcels.sql` - 지번 데이터 변환
- `migration/08_migrate_buildings.sql` - 건물 데이터 변환
- `migration/09_seed_layers.sql` - 레이어 메타데이터

### 3. Elasticsearch 검색 인덱스 (선택)

```bash
bash docker/layer3-apps/gis/migration/10_setup_elasticsearch.sh
```

nori 한국어 분석기 기반 주소 검색 인덱스를 생성합니다.

### 4. GIS 서비스 실행

```bash
make gis
```

5개 서비스(pg-tileserv, pg-featureserv, gis-api, gis-worker, gis-web)를 빌드하고 실행합니다.

### 전체 한 번에 실행

```bash
make data && make gis-init && make gis
```

## 접근 URL

| URL | 설명 |
|-----|------|
| `https://gis.giraffe.ai.kr/` | 메인 지도 UI |
| `https://gis.giraffe.ai.kr/api/docs` | Swagger API 문서 |
| `https://gis.giraffe.ai.kr/api/health` | 헬스체크 |
| `https://gis.giraffe.ai.kr/tiles/` | pg_tileserv UI |
| `https://gis.giraffe.ai.kr/features/` | pg_featureserv UI |

## API 엔드포인트

```
GET    /api/v1/regions/              지역 목록
GET    /api/v1/regions/{code}        지역 상세 (bbox, center, zoom)
POST   /api/v1/regions/              지역 등록 (admin)
GET    /api/v1/layers/?region=       지역별 레이어 목록
GET    /api/v1/layers/{id}/style     레이어 스타일 JSON
GET    /api/v1/search/address?q=     주소 검색 (nori)
GET    /api/v1/search/nearby?lat=..  반경 검색
GET    /api/v1/facilities/?bbox=     시설물 조회 (bbox 필터)
GET    /api/v1/facilities/{id}       시설물 상세
POST   /api/v1/facilities/           시설물 등록 (editor+)
GET    /api/v1/facilities/types      시설물 유형 목록
POST   /api/v1/import/upload         파일 업로드 + 수집 작업 생성
GET    /api/v1/import/history        수집 이력 (editor+)
GET    /api/v1/import/status/{id}    수집 상태
POST   /api/v1/auth/login            JWT 로그인
POST   /api/v1/auth/refresh          토큰 갱신
GET    /api/v1/auth/me               현재 사용자
GET    /api/health                   헬스체크
```

## 환경 변수

`.env` 파일에 다음 변수가 필요합니다:

| 변수 | 설명 | 예시 |
|------|------|------|
| `GIS_DB_NAME` | GIS 데이터베이스명 | `gisdb` |
| `GIS_JWT_SECRET` | JWT 서명 키 | (랜덤 32자) |
| `GIS_MINIO_ENDPOINT` | MinIO 엔드포인트 | `minio:9000` |
| `GIS_MINIO_ACCESS_KEY` | MinIO 접근 키 | `${MINIO_ROOT_USER}` |
| `GIS_MINIO_SECRET_KEY` | MinIO 시크릿 키 | `${MINIO_ROOT_PASSWORD}` |
| `GIS_MINIO_BUCKET` | MinIO 버킷명 | `gis-imports` |
| `GIS_KAFKA_BOOTSTRAP` | Kafka 브로커 주소 | `kafka:9092` |
| `CF_GIS_HOST` | Cloudflare 도메인 | `gis.giraffe.ai.kr` |

## 상태 확인

```bash
# 서비스 상태 확인
bash docker/layer3-apps/gis/gis-status.sh

# 개별 로그 확인
make logs name=gis-api
make logs name=gis-web
make logs name=gis-worker
make logs name=pg-tileserv
make logs name=pg-featureserv
```

## 데이터 업로드 (API)

```bash
# Shapefile 업로드 (ZIP으로 묶어서)
curl -X POST "https://gis.giraffe.ai.kr/api/v1/import/upload?region_code=11350&target_table=parcels" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@parcels.zip"
```

지원 포맷: `.shp` `.geojson` `.json` `.zip` `.gpkg` `.csv` (최대 500MB)

## 프론트엔드 로컬 개발

```bash
cd gis-web
npm install
npm run dev   # http://localhost:5173
```

Vite dev 서버가 `/api` → `localhost:8000`, `/tiles` → `localhost:7800`으로 프록시합니다.

## 문서

| 문서 | 설명 |
|------|------|
| [운영 가이드](docs/OPERATIONS.md) | 일상 운영: 데이터 임포트, 레이어 관리, ES 인덱싱, 트러블슈팅 |
| [좌표 분석 요약](docs/5.coordinates/SUMMARY.md) | Loop 1~16 좌표 분석 및 GIS 앱 개선 전체 요약 |
| [좌표 분석 이력](docs/5.coordinates/HISTORY.md) | 좌표 틀어짐 분석/수정 상세 작업 이력 |

## 디렉토리 구조

```
gis/
├── docker-compose.yml          # 5개 서비스 정의
├── nginx-spa.conf              # nginx 리버스 프록시 + 타일 캐싱
├── init-gisdb.sh               # DB 초기화 스크립트
├── migrate-legacy.sh           # 레거시 마이그레이션 오케스트레이터
├── initdb/                     # DB 초기화 SQL (01~05)
├── migration/                  # 마이그레이션 SQL + ES 인덱스 (06~10)
├── gis-api/                    # FastAPI 백엔드
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI 앱 진입점
│       ├── config.py           # pydantic-settings 설정
│       ├── deps.py             # JWT 인증 의존성
│       ├── models/             # SQLAlchemy ORM (7개)
│       ├── schemas/            # Pydantic 스키마 (6개)
│       ├── routers/            # API 라우터 (6개)
│       └── services/           # Redis, ES, Kafka, MinIO (4개)
├── gis-worker/                 # Kafka 수집 워커
│   ├── Dockerfile
│   ├── requirements.txt
│   └── worker/
│       ├── main.py             # Kafka consumer 메인 루프
│       ├── config.py           # 설정
│       └── ingest.py           # 6단계 수집 파이프라인
└── gis-web/                    # React 프론트엔드
    ├── Dockerfile              # 멀티스테이지 (Node → nginx)
    ├── package.json
    ├── vite.config.ts
    ├── playwright.config.ts
    ├── e2e/                    # E2E 테스트 (4개 spec)
    └── src/
        ├── App.tsx             # 메인 앱 (인증 가드 + 반응형)
        ├── api/                # API 클라이언트 (7개)
        ├── stores/             # Zustand 스토어 (3개)
        └── components/
            ├── map/            # MapView, LayerManager, MapControls
            ├── search/         # SearchBar, SearchResults
            ├── sidebar/        # RegionSelector, LayerTree, FacilityDetail
            ├── admin/          # AdminPanel, DataUpload, ImportHistory
            ├── auth/           # LoginForm, UserMenu
            └── common/         # ErrorBoundary, Spinner
```

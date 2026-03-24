# GIS Utility Map - MVP 구현 계획

## 프로젝트 개요
포천시 하수도 정보 관리 시스템의 현대적 재구현. 레거시 분석(docs/analysis/01~05)을 기반으로,
기존 serengeti-iac 인프라(PostgreSQL 16+PostGIS, Redis 7, Elasticsearch 8, Kafka 3.9, MinIO)를
활용하여 독립 배포 가능한 GIS 웹 애플리케이션 MVP를 구현한다.

## 기존 인프라 현황
serengeti-iac에서 이미 가동 중인 서비스:
- **data-tier 네트워크**: PostgreSQL(+PostGIS 3.4), Redis, Elasticsearch, Kafka, MinIO
- **proxy-tier 네트워크**: Nginx Proxy Manager(NPM)
- **GIS DB(gisdb)**: gis/auth/audit 스키마, 8개 테이블, parcels 254,741건, buildings 8,721건
- **ES 인덱스(gis-address)**: nori 형태소 분석, 263,462건 인덱싱 완료
- **GIS 서비스**: pg-tileserv, pg-featureserv, gis-worker (serengeti-iac에서 관리)

## 핵심 원칙
1. **Python 의존성 관리는 uv 사용** (pip/requirements.txt 대신)
2. **각 서비스별 Dockerfile + 프로젝트 루트 docker-compose.yml** 구성
3. **기존 docker network(data-tier, proxy-tier) 활용** - `docker network ls`로 실시간 확인
4. **기존 DB/서비스에 영향 없도록 주의** - gisdb만 사용, 별도 스키마/테이블
5. **src/HISTORY.md에 모든 작업 과정 기록**

## 프로젝트 구조 (목표)
```
gis-utility-map/
├── PROMPT.md                 # 이 파일 (구현 계획)
├── README.md                 # 프로젝트 설명 및 실행 가이드
├── docker-compose.yml        # 전체 서비스 오케스트레이션
├── .env.example              # 환경변수 템플릿
├── docs/                     # 분석 문서 (기존)
│   └── analysis/             # 01~06 분석 보고서
├── origin/                   # 레거시 코드 (읽기 전용 참조)
├── src/
│   ├── HISTORY.md            # 작업 이력
│   ├── api/                  # FastAPI 백엔드 (Python, uv)
│   │   ├── Dockerfile
│   │   ├── pyproject.toml    # uv 프로젝트 설정
│   │   └── app/              # FastAPI 앱 코드
│   ├── web/                  # React 프론트엔드
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/              # React 소스
│   └── worker/               # 데이터 수집 워커 (Python, uv)
│       ├── Dockerfile
│       ├── pyproject.toml    # uv 프로젝트 설정
│       └── worker/           # 워커 코드
└── infra/
    ├── nginx-spa.conf        # gis-web nginx 설정
    ├── initdb/               # DB 초기화 SQL (참조용)
    └── migration/            # 마이그레이션 스크립트 (참조용)
```

## 구현 단계 (루프별)

### Phase 1: 프로젝트 기반 구축 (Loop 1~2)
- [x] docs/ 분석 → PROMPT.md 구체화 + README.md 작성
- [x] src/api/ 프로젝트 셋업 (uv init, pyproject.toml, FastAPI 기본 구조)
- [x] src/web/ 프로젝트 셋업 (Vite + React 19 + TypeScript + MapLibre GL JS)
- [x] src/worker/ 프로젝트 셋업 (uv init, Kafka consumer 기본 구조)
- [x] docker-compose.yml + .env.example 작성 (기존 네트워크 연결)

### Phase 2: 백엔드 API (Loop 3~5)
- [x] Region/Layer/Search/Facility API 구현 (04 설계 기반)
- [x] JWT 인증 + 역할 기반 접근제어
- [x] Redis 캐싱 (graceful fallback)
- [x] Elasticsearch 검색 + 자동완성 (nori)
- [x] MinIO 파일 업로드 + Kafka 이벤트 발행
- [x] /api/health 상세 엔드포인트

### Phase 3: 프론트엔드 (Loop 4~8)
- [x] MapLibre GL JS 지도 렌더링 + 동적 레이어
- [x] 지역 선택 → 동적 Bounding Box (fitBounds)
- [x] 레이어 트리 (카테고리별 토글)
- [x] 주소 검색 + 자동완성 (debounce 300ms)
- [x] 시설물 상세 패널 (MapLibre Popup 연동)
- [x] 로그인 UI + 관리자 데이터 업로드 UI
- [x] 반응형 레이아웃 (모바일 사이드바)
- [x] nginx 프록시 (API, Tile, Feature) + Docker DNS resolver
- [x] 벡터 타일 연동 (pg-tileserv table tiles)
- [x] RPC 함수 CRS 수정 (ST_Transform 적용) + 레이어 스타일 MapLibre 호환 형식 변환
- [x] 브라우저 실환경 테스트 (지도 렌더링, 레이어 토글, 검색 등)

### Phase 4: 데이터 수집 워커 (Loop 4~10)
- [x] Kafka consumer 메인 루프 (graceful shutdown)
- [x] Kafka 토픽 자동 생성 + graceful startup (재시도 로직)
- [x] GeoJSON 임포트 파이프라인 (Python 직접 파싱 + ST_GeomFromGeoJSON)
- [x] SRID 자동 감지 + 좌표계 변환 (한국 좌표계 7종 + ogrinfo fallback)
- [x] 스테이징 → gis 스키마 변환 (실제 DB 스키마 기반 TRANSFORM_SQL)
- [x] SHP 파일 임포트 검증 (shp2pgsql + 동적 컬럼 매핑 + 좌표 범위 SRID 추론)
- [x] GPKG 파일 임포트 검증 (ogr2ogr PGDUMP 파이프라인)

### Phase 5: 통합 및 배포 (Loop 11~12)
- [x] E2E 테스트 (Playwright)
- [x] nginx 벡터 타일 캐싱 (proxy_cache)
- [x] 번들 최적화 (code splitting, manualChunks)
- [x] Docker Compose 전체 서비스 기동 검증
- [x] gis-status.sh 종합 헬스체크

## 기존 코드 참조
serengeti-iac의 기존 구현체를 참조하되, 이 프로젝트에 맞게 재구성한다:
- 참조 경로: `~/workspace/serengeti-iac/docker/layer3-apps/gis/`
- 주요 변경점: requirements.txt → uv(pyproject.toml), 디렉토리 구조 정리, 독립 docker-compose

## 기술 스택
| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 | FastAPI + SQLAlchemy + GeoAlchemy2 | Python 3.12 |
| 의존성 관리 | uv | latest |
| 프론트엔드 | React + MapLibre GL JS + TypeScript | React 19, Vite 6 |
| 상태 관리 | Zustand | 5.x |
| CSS | Tailwind CSS | 4.x |
| DB | PostgreSQL 16 + PostGIS 3.4 | (기존 인프라) |
| 캐시 | Redis 7 | (기존 인프라) |
| 검색 | Elasticsearch 8 + nori | (기존 인프라) |
| 메시지 | Kafka 3.9 | (기존 인프라) |
| 스토리지 | MinIO | (기존 인프라) |
| 타일 서버 | pg_tileserv | (기존 인프라) |
| Feature 서버 | pg_featureserv | (기존 인프라) |

## 주의사항
- 기존 gisdb에 이미 데이터가 적재되어 있으므로 CREATE TABLE 시 `IF NOT EXISTS` 사용
- Docker network는 external로 선언 (data-tier, proxy-tier)
- .env에서 기존 serengeti-iac의 DB 크리덴셜 참조
- pg-tileserv, pg-featureserv는 serengeti-iac에서 이미 관리중이므로, 이 프로젝트에서는 gis-api, gis-web, gis-worker만 구현

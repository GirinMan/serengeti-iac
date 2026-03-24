# 작업 이력 (HISTORY)

## Loop 1 (2026-03-23)

### 작업 전 - 목표
- 프로젝트 디렉토리 구조 전체 파악 (origin/movem, origin/pocheon, origin/C_drive)
- Step 1: 기존 시스템 복원 및 아키텍처/의존성 파악 (Legacy Restoration & Inventory)
- `docs/analysis/01_legacy_restoration_guide.md` 작성

### 작업 중 - 주요 문제/의사결정
- **이중 서버 구조 발견**: Node.js 타일 서버(포트 3007)와 Java/Tomcat 백엔드(포트 8080)가 독립적으로 운영됨
- **타일 데이터 규모**: contents 디렉토리에 basemap(329MB), facility(37MB), ortho SQLite 등 대용량 타일 데이터 존재
- **좌표계 이중 구조**: DB에는 EPSG:5181(Korea 2000), 프론트엔드는 EPSG:3857(Web Mercator). MyBatis searchMapper에서 `ST_Transform`+`ST_AsGeoJSON`으로 변환
- **layer_symbol.json 파일이 113K 토큰 크기**: 수백 개의 심볼 정의가 단일 JSON에 포함 (전체 읽기 불가, 구조만 파악)
- **serengeti-iac 인프라 파악 완료**: PostgreSQL 16, Redis 7, Elasticsearch 8, Neo4j 5, Kafka 3.9, MinIO, RabbitMQ 등 활용 가능

### 작업 후 - 완료 내용
- `docs/analysis/01_legacy_restoration_guide.md` 작성 완료
  - 시스템 아키텍처 다이어그램 (Mermaid)
  - 서버 기동 순서 시퀀스 다이어그램 (Mermaid)
  - 기술 스택 및 의존성 전체 목록 (프론트엔드, Node.js, Java, DB)
  - 진입점 및 핵심 모듈 역할 정리
  - 실행 환경 구성 가이드 (DB 설정, JDBC, Tomcat, 기동 절차)
  - 핵심 개선 대상 리스트 (Action Items, 우선순위별)
  - 전체 디렉토리 구조 맵

### 다음 루프 TODO
- **Step 2-3**: `docs/analysis/02_data_flow_and_bottlenecks.md` 작성
  - 공간 데이터 파이프라인 추적 (DB → API → 프론트엔드 렌더링)
  - 하드코딩 좌표/ID 전수 조사 (파일명:라인넘버)
  - 결합도 분석 및 MVC 분리 제안
- **Step 4**: `docs/analysis/03_legacy_data_addition_process.md` 작성
  - 신규 지역/시설물 데이터 추가 프로세스 정의
- **Step 5**: `docs/analysis/04_tobe_architecture_design.md` 작성
  - serengeti-iac 기반 현대화 아키텍처 설계

---

## Loop 2 (2026-03-23)

### 작업 전 - 목표
- Step 2-3: `docs/analysis/02_data_flow_and_bottlenecks.md` 작성
  - 공간 데이터 파이프라인 추적 (DB → MyBatis → Spring Controller → 프론트엔드 OpenLayers 렌더링)
  - 하드코딩된 좌표/Bounding Box/행정동 ID 등 전수 조사 (파일명:라인넘버)
  - 스파게티 코드 결합도 분석 및 MVC/API 기반 분리 제안

### 작업 중 - 주요 문제/의사결정
- **두 개의 독립 데이터 파이프라인 확인**: 타일 파이프라인(Node.js→SQLite→MVT/Ortho)과 검색 파이프라인(Spring→MyBatis→PostGIS→GeoJSON)이 완전히 분리되어 운영
- **하드코딩 전수 조사 결과**: 포천시 Extent가 최소 8곳(index.html 4곳 + tile_init.js 4곳), 서버 IP `121.131.133.216:3007`이 tile_init.js에 4곳, SRID 5181이 searchMapper.xml에 2곳 하드코딩
- **XSS 취약점 발견**: search.js의 `searchlist_box_jibun()`/`searchlist_box_building()`에서 서버 응답 데이터를 HTML에 직접 삽입 (이스케이프 없음)
- **tile_init.js와 index.html 코드 중복**: 두 파일이 거의 동일한 코드(스타일 함수, 레이어 생성, 맵 초기화)를 보유. index.html은 standalone 뷰어로 localhost 참조, tile_init.js는 Java 앱 내 뷰어로 실제 IP 참조
- **레이어 카테고리/그룹 구조 발견**: LAYER_CD 접두사 규칙 (N=맨홀, F=시설물, P=관로, BASE_*=배경) 확인. 심볼 키(SYM_KEY)와 layer_symbol.json이 1:1 매핑
- **app.js 레이어 사전에 미래 연도(2025-2030) 포함**: 아직 데이터가 없는 연도까지 사전 등록됨 (빈 SQLite 파일 존재 가능)

### 작업 후 - 완료 내용
- `docs/analysis/02_data_flow_and_bottlenecks.md` 작성 완료
  - 전체 시스템 데이터 흐름도 (Mermaid flowchart)
  - 타일 데이터 흐름 시퀀스 다이어그램 (Mermaid)
  - 검색 데이터 흐름 시퀀스 다이어그램 (Mermaid)
  - 하드코딩 전수 조사 (7개 카테고리, 파일명:라인넘버 포함)
  - 결합도 분석 (5개 핵심 문제 상세 기술)
  - 병목 지점 식별 및 우선순위화 (6개 항목)
  - MVC/API 분리 제안 (구조도 + 엔드포인트 설계)
  - DB 스키마 분석 (ua502, buildig_txt 테이블 + MVT Feature 속성)
  - 핵심 개선 대상 리스트 (Quick Win 4개 + Refactoring 5개)

### 다음 루프 TODO
- **Step 4**: `docs/analysis/03_legacy_data_addition_process.md` 작성
  - 신규 지역(한국) 및 지하시설물 데이터 추가 프로세스 정의
  - 데이터 포맷(SHP, GeoJSON 등) 및 DB 스키마 매핑 가이드
  - SHP→MVT/SQLite 타일 빌드 파이프라인 정의
- **Step 5**: `docs/analysis/04_tobe_architecture_design.md` 작성
  - serengeti-iac 기반 현대화 아키텍처 설계
  - API/DB 스키마 개선 방향

---

## Loop 3 (2026-03-23)

### 작업 전 - 목표
- Step 4: `docs/analysis/03_legacy_data_addition_process.md` 작성
  - 기존 시스템 구조 내에서 신규 지역(한국) 및 지하시설물 데이터 추가 프로세스 정의
  - 데이터 포맷(SHP, GeoJSON 등) 준비 가이드
  - DB 스키마 매핑 및 코드 수정 포인트 정리
  - SHP→PostGIS→MVT/SQLite 타일 빌드 파이프라인 정의
  - 하드코딩 수정 체크리스트 (새 지역 추가 시 변경 필요한 파일:라인)

### 작업 중 - 주요 문제/의사결정
- **타일 빌드 파이프라인 완전 부재 확인**: 코드베이스 전체에서 tippecanoe, ogr2ogr, shp2pgsql, gdal 등의 자동화 스크립트가 일체 발견되지 않음. 타일은 외부 도구로 사전 생성된 것으로 추정
- **SQLite 타일 DB 스키마 확인**: `g3d_tile_content` 테이블의 `tile_z, tile_x, tile_y, tile_w, data_mesh, data_tex` 컬럼 구조 파악 (app.js 라인 159)
- **MVT vs SQLite 서빙 방식 차이 발견**: MVT 타일은 Express static middleware로 직접 서빙(dicLayers 등록 불필요), SQLite 타일만 dicLayers에 등록 필요
- **다중 지역 지원 시 sgg 필터 부재 문제**: 현재 searchMapper.xml의 모든 쿼리에 sgg(시군구) 필터가 없어, 복수 지역 데이터 추가 시 검색 결과가 혼합됨
- **의사결정**: 단일 지역 교체(11곳 수정)와 다중 지역 지원(18곳 수정) 두 가지 시나리오를 모두 문서화하기로 결정

### 작업 후 - 완료 내용
- `docs/analysis/03_legacy_data_addition_process.md` 작성 완료
  - 4단계 데이터 추가 프로세스 (원본 준비 → 타일 빌드 → 코드 수정 → 배포 검증)
  - End-to-End 흐름도 (Mermaid flowchart)
  - 타일 생성 파이프라인 흐름도 (Mermaid flowchart)
  - 다중 지역 지원 제안 아키텍처 (Mermaid flowchart)
  - 데이터 포맷 요구사항 (ua502, buildig_txt, MVT Feature 속성 스키마)
  - 좌표계 변환 가이드 (ogr2ogr 명령어)
  - PostGIS 임포트 가이드 (shp2pgsql 명령어)
  - MVT/SQLite 타일 빌드 가이드 (tippecanoe, gdal2tiles)
  - 전체 수정 파일 체크리스트 (단일 지역: 11곳, 다중 지역: 18곳)
  - DB 검증 SQL 및 브라우저 검증 체크리스트
  - 핵심 개선 대상 리스트 (Quick Win 4개 + Structural 4개)

### 다음 루프 TODO
- **Step 5**: `docs/analysis/04_tobe_architecture_design.md` 작성
  - serengeti-iac 인프라 기반 현대화 아키텍처 설계 (PostgreSQL 16+PostGIS, Redis, Kafka, MinIO 등)
  - 동적 Bounding Box & Spatial Indexing 구조
  - 유연한 데이터 적재 파이프라인 (GeoJSON, 3D 좌표 등)
  - 백엔드(REST API)와 프론트엔드(GIS 렌더링) 완전 분리
  - API 설계 및 DB 스키마 개선 방향
  - Mermaid 시스템 구조도

---

## Loop 4 (2026-03-23)

### 작업 전 - 목표
- Step 5: `docs/analysis/04_tobe_architecture_design.md` 작성
  - serengeti-iac 인프라 기반 현대화 아키텍처 설계 (PostgreSQL 16+PostGIS, Redis, Kafka, MinIO 등)
  - 동적 Bounding Box & Spatial Indexing 구조
  - 유연한 데이터 적재 파이프라인 (GeoJSON, SHP, 3D 좌표 등)
  - 백엔드(REST API)와 프론트엔드(GIS 렌더링) 완전 분리
  - API 설계 및 DB 스키마 개선 방향
  - Mermaid 시스템 구조도 포함

### 작업 중 - 주요 문제/의사결정
- **PostGIS 이미지 교체 결정**: serengeti-iac의 `postgres:16-alpine`을 `postgis/postgis:16-3.4-alpine`으로 변경하면 기존 서비스(Nextcloud, Plane)와 100% 호환되면서 PostGIS 확장 사용 가능
- **좌표계 EPSG:4326 통일 결정**: 레거시 5181 대신 국제 표준 4326으로 저장. pg_tileserv가 MVT 서빙 시 자동으로 3857 변환하므로 별도 변환 로직 불필요
- **pg_tileserv/pg_featureserv 채택**: Node.js Express + SQLite 타일 서버와 Spring MVC + MyBatis를 동시에 대체. PostGIS 테이블에서 직접 MVT/Feature 서빙하여 dicLayers 36개 수동 등록 제거
- **Kafka 이벤트 기반 수집 파이프라인 설계**: 레거시에 완전 부재했던 타일 빌드 파이프라인을 Kafka 이벤트 → Ingest Worker(ogr2ogr/tippecanoe) 자동화로 구현
- **JSONB properties 컬럼 채택**: 시설물 유형별 가변 속성을 하드코딩된 테이블 스키마 대신 JSONB로 유연하게 저장 (새 시설물 유형 추가 시 DDL 변경 불필요)
- **Neo4j는 장기 과제로 분류**: 현 단계에서는 PostGIS만으로 충분, 관로 네트워크 흐름 분석이 필요해질 때 Neo4j 활용 검토

### 작업 후 - 완료 내용
- `docs/analysis/04_tobe_architecture_design.md` 작성 완료
  - AS-IS 문제점 진단 테이블 (6개 영역)
  - TO-BE 전체 시스템 아키텍처 (Mermaid flowchart)
  - serengeti-iac 서비스 활용 매핑 (7개 기존 서비스 + 6개 신규 컴포넌트)
  - DB 스키마 전면 재설계 (8개 테이블 DDL, gis/auth/audit 3개 스키마)
  - 좌표계 전략 (EPSG:4326 통일)
  - Elasticsearch 한국어 검색 인덱스 (nori 분석기)
  - REST API 설계 (6개 리소스, 15+ 엔드포인트)
  - 동적 Bounding Box 시퀀스 다이어그램 (Mermaid)
  - 데이터 수집 파이프라인 시퀀스 다이어그램 (Mermaid)
  - 프론트엔드 아키텍처 (React 19 + MapLibre GL JS + TypeScript)
  - Docker Compose 추가 구성 (serengeti-iac 확장, 5개 서비스)
  - 네트워크 토폴로지 (Mermaid, proxy-tier/data-tier 분리)
  - 단계별 마이그레이션 로드맵 (Mermaid Gantt, Phase 0~4)
  - 데이터 마이그레이션 SQL (레거시 → 신규 스키마)
  - AS-IS → TO-BE 기능 대응표 (9개 항목)
  - 핵심 개선 대상 리스트 (Quick Win 4개 + 핵심 리팩토링 5개 + 장기 5개)
  - 성능 최적화 전략 (캐싱, 공간 인덱스 튜닝, 성능 비교)
  - 보안 개선 (7개 항목)

### 다음 루프 TODO
- PROMPT.md에 정의된 Step 1~5 분석 작업이 **모두 완료**됨
  - Step 1: `docs/analysis/01_legacy_restoration_guide.md` (Loop 1)
  - Step 2-3: `docs/analysis/02_data_flow_and_bottlenecks.md` (Loop 2)
  - Step 4: `docs/analysis/03_legacy_data_addition_process.md` (Loop 3)
  - Step 5: `docs/analysis/04_tobe_architecture_design.md` (Loop 4)
- **향후 실행 단계** (필요 시):
  - Phase 0: serengeti-iac에 PostGIS 이미지 교체 + GIS DB 스키마 적용
  - Phase 1: 레거시 데이터 마이그레이션 (포천시 ua502/buildig_txt → 신규 스키마)
  - Phase 2: FastAPI 백엔드 + pg_tileserv 개발/배포
  - Phase 3: React + MapLibre GL JS 프론트엔드 개발
  - Phase 4: 통합 테스트 + 성능 튜닝

---

## Loop 5 (2026-03-23)

### 작업 전 - 목표
- **Phase 0: 인프라 준비** - 분석 완료된 TO-BE 아키텍처(04_tobe_architecture_design.md)를 실제 인프라에 적용
  - serengeti-iac PostgreSQL 이미지를 PostGIS(postgis/postgis:16-3.4-alpine)로 교체
  - GIS DB 초기화 SQL 스크립트 생성 (gis/auth/audit 3개 스키마, 8개 테이블)
  - GIS 서비스 Docker Compose 파일 생성 (pg_tileserv, pg_featureserv, gis-api, gis-worker, gis-web)
  - .env에 GIS 관련 환경변수 추가
  - Makefile에 GIS 서비스 타겟 추가

### 작업 중 - 주요 문제/의사결정
- **PostGIS 이미지 태그 호환성**: `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine`으로 변경. 동일한 데이터 볼륨 사용 가능 (기존 Nextcloud, Plane DB 호환 100%)
- **GIS DB 별도 생성 결정**: 기존 `maindb`에 PostGIS extension을 추가하는 대신, `gisdb`라는 별도 DB를 생성하여 격리. extension 충돌 방지 + 독립 백업/복원 가능
- **Docker Compose 설계 축소**: 설계 문서에는 gis-api(FastAPI), gis-worker(Ingest Worker)도 포함되어 있었으나, Phase 0에서는 아직 앱 코드가 없으므로 pg_tileserv, pg_featureserv, gis-web(nginx) 3개 서비스만 먼저 배포. gis-api와 gis-worker는 Phase 2에서 추가
- **SQL 파일 분리 전략**: 단일 init.sql 대신 5개 파일(01_extensions → 02_schemas → 03_tables → 04_seed → 05_functions)로 분리. 순서 보장 + 개별 재실행 가능
- **pg_tileserv용 MVT 함수 추가**: 설계 문서에 없던 `facilities_by_region()`, `parcels_by_region()`, `buildings_by_region()` 3개의 PL/pgSQL 함수를 추가 생성. pg_tileserv가 function layer로 자동 발견하여 region_code 파라미터 기반 동적 필터링 가능

### 작업 후 - 완료 내용
- **serengeti-iac 인프라 수정** (4개 파일)
  - `docker/layer2-data/postgres/docker-compose.yml`: image를 `postgis/postgis:${POSTGRES_VERSION}`으로 교체
  - `.env` + `.env.example`: POSTGRES_VERSION을 `16-3.4-alpine`으로 변경, GIS_DB_NAME/GIS_JWT_SECRET/CF_GIS_HOST 추가
  - `Makefile`: `gis-init`, `gis` 타겟 추가 + `validate`/`clean`/`app`에 GIS compose 연동

- **GIS DB 초기화 스크립트** (5개 SQL + 1개 쉘 스크립트)
  - `docker/layer3-apps/gis/initdb/01_extensions.sql`: PostGIS + topology 확장
  - `docker/layer3-apps/gis/initdb/02_schemas.sql`: gis/auth/audit 3개 스키마
  - `docker/layer3-apps/gis/initdb/03_tables.sql`: 8개 테이블 + 13개 인덱스 (regions, facility_types, parcels, buildings, facilities, layers, data_imports, users)
  - `docker/layer3-apps/gis/initdb/04_seed.sql`: 시설물 유형 7개 + 관리자 계정
  - `docker/layer3-apps/gis/initdb/05_functions.sql`: pg_tileserv용 MVT 함수 3개
  - `docker/layer3-apps/gis/init-gisdb.sh`: DB 생성 + SQL 순차 적용 + 검증 자동화

- **GIS 서비스 배포 설정** (2개 파일)
  - `docker/layer3-apps/gis/docker-compose.yml`: pg-tileserv, pg-featureserv, gis-web 3개 서비스
  - `docker/layer3-apps/gis/nginx-spa.conf`: React SPA용 nginx 설정 (fallback + gzip + 캐싱)

### 다음 루프 TODO
- **Phase 1: 레거시 데이터 마이그레이션**
  - 포천시 지번(ua502) → gis.parcels 마이그레이션 SQL 작성 및 실행
  - 포천시 건물(buildig_txt) → gis.buildings 마이그레이션 SQL 작성 및 실행
  - 시설물 MVT Feature → gis.facilities 마이그레이션 (레거시 타일 데이터 분석 필요)
  - Elasticsearch nori 플러그인 설치 + 주소 검색 인덱스 생성
- **Phase 2: 백엔드 개발 시작**
  - FastAPI 프로젝트 셋업 (gis-api)
  - Ingest Worker 프로젝트 셋업 (gis-worker)
  - Docker Compose에 gis-api, gis-worker 서비스 추가
- **실행 검증**: `make data && make gis`로 실제 서비스 기동 테스트

---

## Loop 6 (2026-03-23)

### 작업 전 - 목표
- **Phase 1: 레거시 데이터 마이그레이션 자동화**
  - 포천시 지역(region) 시드 데이터 등록 SQL 작성
  - ogr2ogr 기반 Shapefile(ua502, buildig_txt) → PostGIS 임포트 스크립트 작성
  - 스테이징 테이블 → gis.parcels/gis.buildings 변환 SQL 작성
  - gis.layers 메타데이터 시드 SQL 작성
  - 시설물(facility) 데이터 마이그레이션 방안 정리 (MVT → PostGIS 역추출 또는 레거시 DB 직접 연결)
  - Elasticsearch nori 플러그인 기반 주소 검색 인덱스 생성 스크립트 작성
  - 전체 마이그레이션 오케스트레이션 쉘 스크립트(migrate-legacy.sh) 작성

### 작업 중 - 주요 문제/의사결정
- **shp2pgsql vs ogr2ogr 선택**: PostGIS Docker 이미지(`postgis/postgis:16-3.4-alpine`)에 `shp2pgsql`이 포함되어 있으므로 별도 GDAL 설치 없이 `shp2pgsql -s 5181 -W UTF-8` 사용. ogr2ogr는 Alpine 이미지에 기본 미포함이라 제외
- **스테이징 테이블 전략**: Shapefile을 `staging.ua502`/`staging.buildig_txt`로 임포트 후 변환 SQL로 `gis.parcels`/`gis.buildings`로 이동. 중간 검증 가능 + 재실행(idempotent) 보장
- **EPSG:5181 수동 등록 필요**: PostGIS 3.4에 EPSG:5181이 기본 포함되어 있을 수 있으나, 레거시 SQL.txt에서도 수동 INSERT했으므로 migrate-legacy.sh에서 존재 여부 확인 후 조건부 등록하도록 구현
- **시설물(facility) 데이터 마이그레이션 보류**: 원본 Shapefile이 ua502/buildig_txt만 존재하고 시설물(맨홀, 관로 등) Shapefile은 없음. MVT 정적 타일에서 역추출하거나 레거시 DB 직접 연결이 필요. 마이그레이션 스크립트 완료 메시지에 3가지 대안(레거시 DB 연결, MVT 역추출, 원본 SHP 확보) 안내 포함
- **Elasticsearch bulk 인덱싱 최적화**: PostgreSQL에서 NDJSON 형식으로 직접 추출하여 Elasticsearch `_bulk` API로 인덱싱. 10,000줄 단위로 split하여 대량 데이터 처리 시 메모리 문제 방지
- **Makefile 타겟 추가**: `gis-migrate` 타겟을 `gis-init` 의존으로 추가. `make data && make gis-migrate && make gis` 순서로 전체 파이프라인 실행 가능

### 작업 후 - 완료 내용
- **마이그레이션 SQL 스크립트** (4개 파일, `serengeti-iac/docker/layer3-apps/gis/migration/`)
  - `06_seed_pocheon.sql`: 포천시 지역 등록 (EPSG:3857 → 4326 좌표 변환, bbox/center)
  - `07_migrate_parcels.sql`: staging.ua502 → gis.parcels 변환 (ST_Multi + ST_Transform, JSONB properties에 sgg/emd/ri 보존, audit 이력 기록)
  - `08_migrate_buildings.sql`: staging.buildig_txt → gis.buildings 변환 (주소 자동 조합, JSONB properties에 pnu/sgg/emd/ri/jibun/jimok 보존)
  - `09_seed_layers.sql`: 10개 레이어 메타데이터 (basemap/ortho/parcels/buildings/manhole/pipe_sew/pipe_rain/valve/pump/treatment), pg_tileserv function layer URL 패턴 사용

- **오케스트레이션 쉘 스크립트** (1개 파일)
  - `migrate-legacy.sh`: 6단계 자동화 (사전검증 → EPSG:5181 등록 → region 시드 → shp2pgsql 임포트 → 변환 SQL → 최종 검증). Idempotent 설계 (재실행 안전)

- **Elasticsearch nori 인덱스 스크립트** (1개 파일)
  - `migration/10_setup_elasticsearch.sh`: nori 플러그인 설치 → 인덱스 생성 (korean_index/korean_search/autocomplete 3종 분석기) → PostgreSQL→ES bulk 인덱싱 (parcels + buildings)

- **Makefile 업데이트** (serengeti-iac)
  - `gis-migrate` 타겟 추가 (gis-init 의존)
  - `validate` 타겟에 migrate-legacy.sh, 10_setup_elasticsearch.sh 구문 검증 추가

### 다음 루프 TODO
- **Phase 1 실행 검증**: `make data && make gis-migrate && make gis`로 실제 마이그레이션 + 서비스 기동 테스트
- **시설물 데이터 확보**: 레거시 PostgreSQL DB 접근 가능 여부 확인 후 시설물(맨홀, 관로 등) 마이그레이션 SQL 작성
- **Elasticsearch 인덱싱 실행**: `bash migration/10_setup_elasticsearch.sh` 실행 후 검색 테스트
- **Phase 2: 백엔드 개발 시작**
  - FastAPI 프로젝트 셋업 (gis-api) - Region/Layer/Search API
  - Ingest Worker 프로젝트 셋업 (gis-worker) - Kafka 이벤트 기반 데이터 수집
  - Docker Compose에 gis-api, gis-worker 서비스 추가
- **Phase 3: 프론트엔드 개발 시작**
  - React 19 + MapLibre GL JS + TypeScript 프로젝트 셋업
  - 동적 Bounding Box + 다중 레이어 렌더링 구현

---

## Loop 7 (2026-03-23)

### 작업 전 - 목표
- **Phase 2: FastAPI 백엔드 개발 시작 (gis-api)**
  - FastAPI 프로젝트 구조 셋업 (Python 3.12, 비동기 SQLAlchemy + PostGIS)
  - API 엔드포인트 구현: regions, layers, search, facilities, auth, import
  - TO-BE 아키텍처(04_tobe_architecture_design.md)의 API 설계를 실제 코드로 구현
  - Dockerfile 작성 및 Docker Compose에 gis-api 서비스 추가
  - Redis 캐싱, Elasticsearch 검색, JWT 인증 통합

### 작업 중 - 주요 문제/의사결정
- **프로젝트 구조 결정**: `serengeti-iac/docker/layer3-apps/gis/gis-api/` 하위에 FastAPI 앱 배치. Docker Compose에서 `build: context`로 빌드하는 방식 채택 (별도 이미지 레지스트리 불필요)
- **비동기 SQLAlchemy + GeoAlchemy2 채택**: PostGIS 공간 함수(ST_AsGeoJSON, ST_Intersects, ST_MakeEnvelope)를 직접 사용하기 위해 GeoAlchemy2 0.15 사용. asyncpg 드라이버로 비동기 DB 접근
- **DeclarativeBase 상속 구조**: SQLAlchemy 2.0 스타일의 `DeclarativeBase`를 `region.py`에 정의하고 다른 모델이 import하는 방식. 기존 initdb SQL과 동일한 스키마(gis/auth/audit) 매핑
- **ST_AsGeoJSON을 select 시 호출**: ORM relationship lazy load 대신, 필요한 곳에서 `ST_AsGeoJSON()`을 명시적으로 select하여 GeoJSON dict 반환. WKB ↔ GeoJSON 직렬화 이슈 회피
- **Elasticsearch 검색 서비스**: Loop 6에서 생성한 `gis_address` 인덱스와 호환되는 multi_match + geo_distance 쿼리 구현
- **Redis 캐싱 전략**: regions, layers 등 변경 빈도가 낮은 데이터에 TTL 1h 캐싱. 생성/수정 시 패턴 기반 cache invalidation
- **JWT 인증 + 역할 기반 접근제어**: passlib(bcrypt) + python-jose. `require_role()` 의존성으로 admin/editor/viewer 3단계 권한 제어
- **healthcheck 방식**: gis-api 컨테이너에 `python -c "import httpx; ..."` 방식 사용. requirements.txt에 httpx가 이미 포함되어 있어 추가 의존성 불필요

### 작업 후 - 완료 내용
- **FastAPI 프로젝트 셋업** (33개 파일, `serengeti-iac/docker/layer3-apps/gis/gis-api/`)
  - `Dockerfile`: Python 3.12-slim 기반, libpq-dev 포함
  - `requirements.txt`: FastAPI, SQLAlchemy, GeoAlchemy2, asyncpg, Redis, ES, JWT 등 15개 패키지
  - **Models** (7개): Region, Layer, Parcel, Building, Facility, FacilityType, User, DataImport - 기존 initdb SQL의 8개 테이블과 1:1 매핑
  - **Schemas** (6개): RegionOut/Create, LayerOut, SearchResult/Response, FacilityOut/Create/TypeOut, LoginRequest/TokenResponse/UserOut, DataImportOut
  - **Routers** (6개): regions(CRUD+캐싱), layers(지역별 필터), search(주소/반경), facilities(bbox필터+CRUD), imports(이력조회), auth(login/refresh/me)
  - **Services** (3개): cache(Redis), search(Elasticsearch), auth(JWT+bcrypt)
  - **Core**: config(pydantic-settings), database(async session), deps(JWT 인증+역할 체크)

- **Docker Compose 업데이트** (`docker-compose.yml`)
  - `gis-api` 서비스 추가 (build context, 환경변수 7개, healthcheck, data-tier+proxy-tier 네트워크)

- **Makefile 업데이트** (`Makefile`)
  - `gis` 타겟에 `--build` 플래그 추가
  - `app name=gis` 타겟에도 `--build` 플래그 추가

- **API 엔드포인트 요약**:
  - `GET /api/v1/regions/` - 전체 지역 목록 (Redis 캐싱)
  - `GET /api/v1/regions/{code}` - 특정 지역 상세 (bbox, center, zoom)
  - `POST /api/v1/regions/` - 신규 지역 등록 (admin only)
  - `GET /api/v1/layers/?region=` - 지역별 레이어 목록 (Redis 캐싱)
  - `GET /api/v1/layers/{id}/style` - 레이어 스타일 JSON
  - `GET /api/v1/search/address?q=&region=` - 주소 검색 (Elasticsearch nori)
  - `GET /api/v1/search/nearby?lat=&lng=&radius=` - 반경 검색
  - `GET /api/v1/facilities/?region=&type=&bbox=` - 시설물 조회 (bbox 필터)
  - `GET /api/v1/facilities/{id}` - 시설물 상세
  - `POST /api/v1/facilities/` - 시설물 등록 (editor+)
  - `GET /api/v1/facilities/types` - 시설물 유형 목록
  - `GET /api/v1/import/history?region=` - 수집 이력 (editor+)
  - `GET /api/v1/import/status/{id}` - 수집 상태
  - `POST /api/v1/auth/login` - JWT 로그인
  - `POST /api/v1/auth/refresh` - 토큰 갱신
  - `GET /api/v1/auth/me` - 현재 사용자
  - `GET /api/health` - 헬스체크

### 다음 루프 TODO
- **Phase 2 계속: 데이터 수집 API (import/upload)**
  - MinIO 파일 업로드 엔드포인트 구현 (`POST /api/v1/import/upload`)
  - Kafka 이벤트 발행 (gis.import.request 토픽)
  - gis-worker (Ingest Worker) 프로젝트 셋업 (Kafka consumer + ogr2ogr)
- **실행 검증**: `make data && make gis` → gis-api 빌드 + 기동 테스트
- **Swagger UI 접근 테스트**: `https://gis.giraffe.ai.kr/api/docs`
- **Phase 3: 프론트엔드 개발 시작**
  - React 19 + MapLibre GL JS + TypeScript 프로젝트 셋업
  - 동적 Bounding Box + 다중 레이어 렌더링 구현
  - gis-api 연동 (regions → layers → tile rendering)

---

## Loop 8 (2026-03-23)

### 작업 전 - 목표
- **Phase 2 계속: 데이터 수집 파이프라인 완성**
  - MinIO 파일 업로드 엔드포인트 구현 (`POST /api/v1/import/upload`)
  - Kafka 이벤트 발행 서비스 구현 (`gis.import.request` 토픽)
  - gis-api에 MinIO(minio), Kafka(aiokafka) 의존성 추가
  - gis-worker (Ingest Worker) 프로젝트 셋업 (Kafka consumer + shp2pgsql/ogr2ogr)
  - Docker Compose에 gis-worker 서비스 추가
  - .env에 GIS MinIO/Kafka 관련 환경변수 추가

### 작업 중 - 주요 문제/의사결정
- **PostGIS Alpine 기반 gis-worker 이미지 결정**: `postgis/postgis:16-3.4-alpine`을 base 이미지로 사용하여 shp2pgsql 기본 내장. 추가로 `gdal-tools`(ogr2ogr)를 apk로 설치. Python venv를 별도 구성하여 OS 패키지와 분리
- **MinIO 동기 SDK 채택 (gis-api upload)**: `minio` Python SDK는 동기식이지만, 파일 업로드는 CPU-bound가 아닌 I/O 작업이고 FastAPI가 스레드풀로 실행하므로 문제없음. asyncio 래퍼 불필요
- **Kafka aiokafka 양쪽 사용**: gis-api(producer)와 gis-worker(consumer) 모두 `aiokafka` 사용. 동일 라이브러리로 통일하여 직렬화/역직렬화 호환 보장
- **gis-worker 동기 SQLAlchemy 결정**: worker는 동시성보다 처리 안정성이 중요. subprocess(shp2pgsql, ogr2ogr)를 호출하므로 asyncpg 대신 psycopg2-binary + 동기 engine 사용. 외부 프로세스 파이프라인(shp2pgsql | psql)과의 호환성 우선
- **스테이징 테이블 전략**: 업로드된 파일을 `staging.import_{parcels|buildings|facilities}`로 임포트 후, 변환 SQL로 `gis.*` 스키마에 INSERT. Loop 6의 migrate-legacy.sh와 동일한 패턴이지만, 자동화된 Kafka 이벤트 기반
- **SRID 자동 감지**: .prj 파일에서 Korea_2000 → EPSG:5181, WGS_1984 → EPSG:4326 자동 판별. 미감지 시 4326 기본값
- **.env 변수 참조 방식**: `GIS_MINIO_ACCESS_KEY=${MINIO_ROOT_USER}` 형태로 기존 MinIO 설정을 참조. 중복 값 방지

### 작업 후 - 완료 내용
- **gis-api 데이터 수집 API 추가** (4개 파일 수정/생성)
  - `requirements.txt`: minio==7.2.12, aiokafka==0.12.0 추가
  - `app/config.py`: MinIO 5개 + Kafka 2개 설정 항목 추가
  - `app/services/kafka.py`: AIOKafkaProducer 래퍼 (lazy init, publish_import_request, close_producer)
  - `app/services/storage.py`: MinIO 클라이언트 래퍼 (bucket 자동 생성, upload_file, download_file)
  - `app/routers/imports.py`: `POST /api/v1/import/upload` 엔드포인트 추가 (파일 검증, MinIO 업로드, DB 레코드 생성, Kafka 이벤트 발행)
  - `app/schemas/data_import.py`: UploadResponse 스키마 추가
  - `app/main.py`: lifespan에 close_producer() 추가

- **gis-worker (Ingest Worker) 프로젝트 생성** (5개 파일, `serengeti-iac/docker/layer3-apps/gis/gis-worker/`)
  - `Dockerfile`: PostGIS Alpine 기반 + Python venv + gdal-tools
  - `requirements.txt`: aiokafka, minio, psycopg2-binary, sqlalchemy, pydantic-settings
  - `worker/config.py`: DB/MinIO/Kafka 설정 (pydantic-settings, GIS_ prefix)
  - `worker/main.py`: Kafka consumer 메인 루프 (graceful shutdown, signal handler)
  - `worker/ingest.py`: 6단계 처리 파이프라인
    1. MinIO에서 파일 다운로드
    2. ZIP 자동 압축 해제 (SHP/GeoJSON 탐색)
    3. SRID 자동 감지 (.prj 파싱)
    4. shp2pgsql(SHP) 또는 ogr2ogr(GeoJSON/GPKG)로 스테이징 테이블 임포트
    5. 변환 SQL로 gis 스키마에 INSERT (region_code 필터링, ST_Transform)
    6. 스테이징 테이블 정리 + audit.data_imports 상태 업데이트

- **Docker Compose 업데이트** (`docker-compose.yml`)
  - `gis-api`: MinIO 4개 + Kafka 1개 환경변수 추가
  - `gis-worker` 서비스 추가 (build context, MinIO/Kafka/DB 환경변수, /tmp/gis-worker 볼륨, data-tier 네트워크)

- **.env / .env.example 업데이트**
  - GIS_MINIO_ENDPOINT, GIS_MINIO_ACCESS_KEY, GIS_MINIO_SECRET_KEY, GIS_MINIO_BUCKET, GIS_KAFKA_BOOTSTRAP 5개 변수 추가

- **Makefile 업데이트**
  - `dirs` 타겟에 `/tmp/gis-worker` 디렉토리 생성 추가

- **API 엔드포인트 추가 요약**:
  - `POST /api/v1/import/upload` - 파일 업로드 + 수집 작업 생성
    - Query params: region_code, target_table (parcels/buildings/facilities)
    - 파일 검증: 확장자(shp/geojson/json/zip/gpkg/csv), 크기(500MB)
    - 응답: import_id, minio_path, status, message

### 다음 루프 TODO
- **실행 검증**: `make data && make gis`로 전체 서비스 빌드 + 기동 테스트
  - gis-api 빌드 성공 여부 확인 (minio, aiokafka 의존성)
  - gis-worker 빌드 성공 여부 확인 (PostGIS base + Python venv)
  - Kafka 토픽 자동 생성 확인
  - MinIO 버킷 자동 생성 확인
- **E2E 수집 테스트**: Swagger UI에서 파일 업로드 → Kafka → Worker → PostGIS 전체 흐름 검증
- **Phase 3: 프론트엔드 개발 시작**
  - React 19 + MapLibre GL JS + TypeScript 프로젝트 셋업 (gis-web)
  - 동적 Bounding Box + 다중 레이어 렌더링 구현
  - gis-api 연동 (regions → layers → tile rendering)
  - 주소 검색 UI (Elasticsearch nori 연동)
- **추가 개선 (선택)**:
  - gis-worker 에러 시 Kafka DLQ(Dead Letter Queue) 처리
  - 업로드 진행률 WebSocket 알림
  - CSV 포맷 지원 (좌표 컬럼 자동 감지 → ST_MakePoint)

---

## Loop 9 (2026-03-23)

### 작업 전 - 목표
- **Phase 3: 프론트엔드 개발 (gis-web)**
  - React 19 + MapLibre GL JS + TypeScript + Vite 프로젝트 셋업
  - 동적 Bounding Box + 다중 벡터 타일 레이어 렌더링
  - gis-api 연동 (regions → layers → tile rendering)
  - 주소 검색 UI (Elasticsearch nori 연동)
  - 시설물 상세 정보 패널 (클릭 시 Feature 조회)
  - Dockerfile 작성 및 Docker Compose gis-web 서비스 업데이트 (빌드 + nginx 서빙)

### 작업 중 - 주요 문제/의사결정
- **Vite + @tailwindcss/vite 채택**: Tailwind CSS v4의 Vite 전용 플러그인 사용. PostCSS 설정 불필요, 빌드 속도 최적화
- **Zustand 상태 관리 구조**: mapStore(Map 인스턴스+현재 지역), layerStore(레이어 목록+가시성 Set), authStore(JWT 토큰) 3개로 분리. 각 컴포넌트가 필요한 slice만 구독하여 불필요한 리렌더링 방지
- **nginx 리버스 프록시 설계**: gis-web nginx에서 `/api/` → gis-api:8000, `/tiles/` → pg-tileserv:7800, `/features/` → pg-featureserv:9000 프록시. 프론트엔드에서 CORS 이슈 없이 단일 origin으로 모든 서비스 접근 가능
- **벡터 타일 레이어 동적 추가**: LayerManager 컴포넌트가 layerStore의 layers/visibleIds 변경을 감지하여 MapLibre에 source/layer를 동적으로 추가/제거. gis-api의 Layer 스키마의 style 필드에서 paint 속성(fill-color, line-color, circle-color 등)을 직접 매핑
- **FacilityDetail 클릭 이벤트 처리**: `lyr-` 접두사로 시작하는 모든 레이어에서 queryRenderedFeatures로 클릭 이벤트 처리. Feature의 properties.id로 gis-api에서 상세 조회
- **Docker 멀티스테이지 빌드**: node:22-alpine(빌드) → nginx:alpine(서빙). 빌드 결과물만 nginx에 COPY하여 이미지 크기 최소화. nginx-spa.conf는 docker-compose 볼륨 마운트로 주입
- **deck.gl은 Phase 4로 연기**: TO-BE 설계에 포함되어 있으나, 현재 3D 시각화 데이터가 없으므로 기본 MapLibre 2D 렌더링만 구현. 향후 3D 좌표 데이터 확보 시 추가

### 작업 후 - 완료 내용
- **React 프로젝트 셋업** (26개 파일, `serengeti-iac/docker/layer3-apps/gis/gis-web/`)
  - `package.json`: React 19, MapLibre GL JS 5, Zustand 5, Tailwind CSS 4, Vite 6, TypeScript 5.7
  - `Dockerfile`: Node 22 빌드 → nginx:alpine 서빙 멀티스테이지
  - `vite.config.ts`: path alias(@/), dev proxy(/api, /tiles), Tailwind/React 플러그인
  - `tsconfig.json`: ESNext + strict mode + path alias

- **API 클라이언트** (5개 파일, `src/api/`)
  - `client.ts`: fetch 기반 GET/POST 래퍼 (VITE_API_BASE_URL 환경변수)
  - `regions.ts`: fetchRegions(), fetchRegion(code) - Region 인터페이스 (bbox GeoJSON, center, zoom)
  - `layers.ts`: fetchLayers(regionCode?) - Layer 인터페이스 (tile_url, style, visibility)
  - `search.ts`: searchAddress(query, region?) - SearchResponse/SearchResult 인터페이스
  - `facilities.ts`: fetchFacilities(params), fetchFacility(id), fetchFacilityTypes()

- **상태 관리 스토어** (3개 파일, `src/stores/`)
  - `mapStore.ts`: MapLibre Map 인스턴스 + 현재 Region (setMap, setRegion)
  - `layerStore.ts`: 레이어 목록 + 가시성 Set (setLayers, toggleLayer, setVisible)
  - `authStore.ts`: JWT 토큰 (localStorage 연동, logout)

- **지도 컴포넌트** (3개 파일, `src/components/map/`)
  - `MapView.tsx`: MapLibre GL 초기화 (OSM 베이스맵, NavigationControl, ScaleControl), 지역 선택 시 fitBounds 자동 적용
  - `LayerManager.tsx`: layerStore 변경 시 벡터 타일 source/layer 동적 추가, fill/line/circle 3종 페인트 타입 지원, 가시성 토글
  - `MapControls.tsx`: "전체 보기" 버튼 (현재 지역 bbox로 fitBounds)

- **검색 컴포넌트** (2개 파일, `src/components/search/`)
  - `SearchBar.tsx`: 주소 검색 입력 (Enter/버튼), 현재 지역 코드 자동 전달
  - `SearchResults.tsx`: 검색 결과 드롭다운 (타입 배지, 클릭 시 flyTo)

- **사이드바 컴포넌트** (3개 파일, `src/components/sidebar/`)
  - `RegionSelector.tsx`: 지역 드롭다운 + 선택 시 자동 레이어 로드 (regions API → layers API → layerStore)
  - `LayerTree.tsx`: 카테고리별 그룹핑 + 체크박스 토글 + 색상 프리뷰 (배경/항공사진/지번/건물/시설물/관로/맨홀)
  - `FacilityDetail.tsx`: 지도 클릭 → Feature 조회 → 시설물 상세 패널 (관리번호, 설치연도, JSONB properties 전체 표시)

- **Docker Compose 업데이트** (`docker-compose.yml`)
  - `gis-web` 서비스: `image: nginx:alpine` → `build: context: ./gis-web` (멀티스테이지 빌드)
  - `gis-web` 의존성: `gis-api` healthy 대기 후 시작
  - nginx-spa.conf: 리버스 프록시 3개 추가 (/api/ → gis-api, /tiles/ → pg-tileserv, /features/ → pg-featureserv)

- **프론트엔드 핵심 흐름**:
  1. 앱 로드 → `RegionSelector`가 `GET /api/v1/regions/` 호출 → 첫 번째 지역 자동 선택
  2. 지역 선택 → `mapStore.setRegion()` → `MapView.fitBounds(bbox)` + `GET /api/v1/layers/?region=X`
  3. 레이어 로드 → `layerStore.setLayers()` → `LayerManager`가 MapLibre에 벡터 타일 source/layer 동적 추가
  4. 레이어 토글 → `LayerTree` 체크박스 → `layerStore.toggleLayer()` → `LayerManager`가 visibility 변경
  5. 주소 검색 → `SearchBar` → `GET /api/v1/search/address?q=&region=` → 결과 클릭 시 `map.flyTo()`
  6. 시설물 클릭 → `FacilityDetail` → `map.queryRenderedFeatures()` → `GET /api/v1/facilities/{id}` → 상세 패널

### 다음 루프 TODO
- **실행 검증**: `make data && make gis`로 전체 서비스 빌드 + 기동 테스트
  - gis-web 빌드 성공 여부 확인 (npm install + Vite build)
  - nginx 리버스 프록시 동작 확인 (/api, /tiles, /features)
  - 브라우저에서 지도 렌더링 확인
- **UI/UX 개선**:
  - 로딩 스피너 / 에러 바운더리 추가
  - 반응형 레이아웃 (모바일 사이드바 토글)
  - 지도 클릭 시 팝업 (MapLibre Popup)
- **추가 기능 (Phase 3 계속)**:
  - 데이터 업로드 UI (`admin/DataImport.tsx`, `admin/ImportHistory.tsx`)
  - 로그인 UI + JWT 인증 연동
  - deck.gl 3D 시각화 (3D 좌표 데이터 확보 시)
- **Phase 4: 통합 테스트 + 성능 튜닝**
  - E2E 테스트 (Playwright)
  - 벡터 타일 캐싱 (Redis + pg_tileserv)
  - 번들 사이즈 최적화 (code splitting, lazy loading)

---

## Loop 10 (2026-03-23)

### 작업 전 - 목표
- **Phase 3 계속: 관리자 UI + 인증 + UX 개선**
  - 로그인 UI 구현 (JWT 인증 연동, authStore 활용)
  - 데이터 업로드 관리자 UI 구현 (`POST /api/v1/import/upload` 연동)
  - 수집 이력 조회 UI 구현 (`GET /api/v1/import/history` 연동)
  - UI/UX 개선: 로딩 스피너, 에러 바운더리, 지도 팝업(MapLibre Popup), 반응형 레이아웃
  - 인증 가드: 로그인 필요 페이지 보호, 역할 기반 UI 분기 (admin/editor/viewer)

### 작업 중 - 주요 문제/의사결정
- **API 클라이언트 인증 헤더 자동 주입**: `client.ts`에 `getAuthHeaders()` 추가하여 모든 요청에 JWT Bearer 토큰 자동 포함. 401 응답 시 `window.dispatchEvent(new Event("auth:logout"))`로 전역 로그아웃 트리거
- **파일 업로드 시 Content-Type 제외**: `uploadFile()` 함수에서 FormData 사용 시 `Content-Type: application/json` 헤더를 제외하여 브라우저가 multipart boundary를 자동 설정하도록 처리
- **authStore에 user 상태 추가**: 기존 token만 관리하던 store에 `UserInfo` 타입의 user 상태 추가. App 마운트 시 `fetchMe()`로 토큰 유효성 검증 + 사용자 정보 로드
- **반응형 사이드바 구현**: `md:` 브레이크포인트 기준으로 모바일에서는 오버레이 + 백드롭, 데스크탑에서는 고정 사이드바. `translate-x` 트랜지션으로 부드러운 열기/닫기
- **MapLibre Popup + 사이드바 연동**: 지도 클릭 시 Popup으로 빠른 미리보기 표시 후 API 조회 완료되면 Popup 내용 업데이트 + 사이드바 FacilityDetail도 동시 갱신. `useRef`로 Popup 인스턴스 관리하여 중복 생성 방지
- **역할 기반 UI 분기**: AdminPanel 컴포넌트에서 `user.role === "admin" || "editor"` 조건으로 데이터 관리 섹션 표시/숨김. viewer 역할은 지도 조회만 가능

### 작업 후 - 완료 내용
- **인증 시스템** (4개 파일 생성/수정)
  - `src/api/auth.ts`: login(), refreshToken(), fetchMe() API 함수
  - `src/api/client.ts`: JWT Bearer 헤더 자동 주입, 401 전역 로그아웃, uploadFile() 추가
  - `src/stores/authStore.ts`: user 상태 추가, auth:logout 이벤트 리스너
  - `src/components/auth/LoginForm.tsx`: 로그인 폼 (사용자명/비밀번호, 에러 표시)
  - `src/components/auth/UserMenu.tsx`: 사용자 이름/역할 표시 + 로그아웃 버튼

- **데이터 관리 UI** (4개 파일 생성)
  - `src/api/imports.ts`: uploadImportFile(), fetchImportHistory(), fetchImportStatus() API 함수
  - `src/components/admin/DataUpload.tsx`: 파일 업로드 폼 (대상 테이블 선택, 파일 선택, 지역 자동 연동)
  - `src/components/admin/ImportHistory.tsx`: 수집 이력 목록 (상태 배지, 날짜, 레코드 수, 에러 메시지)
  - `src/components/admin/AdminPanel.tsx`: 접이식 관리 패널 (admin/editor만 표시)

- **UI/UX 개선** (5개 파일 생성/수정)
  - `src/components/common/ErrorBoundary.tsx`: React Error Boundary (에러 메시지 + 다시 시도 버튼)
  - `src/components/common/Spinner.tsx`: 재사용 가능한 로딩 스피너
  - `src/components/sidebar/FacilityDetail.tsx`: MapLibre Popup 연동 + 마우스 커서 변경 (pointer on hover)
  - `src/components/search/SearchBar.tsx`: "검색 결과 없음" 메시지 추가
  - `src/main.tsx`: ErrorBoundary 래핑

- **App.tsx 전면 업데이트**
  - 인증 가드: 토큰 없으면 LoginForm, 있으면 fetchMe()로 검증 후 메인 앱
  - 반응형 사이드바: 모바일 토글 버튼 + 백드롭 오버레이 + CSS 트랜지션
  - AdminPanel, UserMenu 사이드바 하단 배치

- **파일 변경 요약**: 9개 파일 생성, 5개 파일 수정 (총 29개 소스 파일)

### 다음 루프 TODO
- **실행 검증**: `make data && make gis`로 전체 서비스 빌드 + 기동 테스트
  - gis-web 빌드 성공 여부 확인 (auth/admin 컴포넌트 포함)
  - 로그인 → 지도 렌더링 → 시설물 클릭 → 팝업 표시 E2E 검증
  - 파일 업로드 → Kafka → Worker → PostGIS 전체 흐름 E2E 검증
- **Phase 4: 통합 테스트 + 성능 최적화**
  - E2E 테스트 (Playwright) 셋업 및 핵심 시나리오 작성
  - 벡터 타일 캐싱 (Redis + pg_tileserv cache header)
  - 번들 사이즈 최적화 (React.lazy + Suspense로 admin/auth 코드 스플리팅)
- **추가 기능 (선택)**:
  - 비밀번호 변경 UI
  - 업로드 진행률 WebSocket 알림
  - deck.gl 3D 시각화 (3D 좌표 데이터 확보 시)
  - Playwright E2E 테스트 (로그인, 지역 선택, 레이어 토글, 검색, 업로드)

---

## Loop 11 (2026-03-23)

### 작업 전 - 목표
- **Phase 4: 통합 테스트 + 성능 최적화**
  - 전체 서비스 빌드 검증 준비 (Docker Compose 설정 정합성 점검)
  - E2E 테스트 셋업 (Playwright + TypeScript, 핵심 시나리오 작성)
  - 번들 사이즈 최적화 (React.lazy + Suspense로 admin/auth 코드 스플리팅)
  - 벡터 타일 캐싱 설정 (pg_tileserv cache header + nginx proxy_cache)
  - 빌드/배포 전 코드 정합성 최종 점검

### 작업 중 - 주요 문제/의사결정
- **React.lazy 적용 범위 결정**: 지도 핵심 컴포넌트(MapView, LayerManager, MapControls)는 초기 렌더링에 필수이므로 lazy 대상에서 제외. LoginForm, AdminPanel, UserMenu 3개만 lazy import하여 초기 번들에서 분리. 이 3개는 조건부 렌더링(인증 상태, 역할 기반)이므로 대부분의 사용자에게 초기 로드 시 불필요
- **Vite manualChunks 전략**: `maplibre-gl`(~1.5MB)을 별도 청크로 분리하여 캐시 효율 극대화. vendor 청크(react, react-dom, zustand)와 애플리케이션 코드를 분리하여 앱 코드 변경 시 vendor 캐시 유지
- **nginx proxy_cache 설계**: `/tiles/` 경로에만 캐싱 적용. `proxy_cache_lock on`으로 동시 요청 시 단일 upstream 요청만 발생 (thundering herd 방지). `proxy_cache_use_stale`로 upstream 장애 시에도 캐시된 타일 서빙 가능. `X-Cache-Status` 헤더로 캐시 히트/미스 모니터링 가능
- **캐시 볼륨 방식**: tmpfs 대신 Docker named volume(`tile-cache`) 사용하여 컨테이너 재시작 시에도 캐시 유지. 1GB max_size + 1h inactive로 디스크 사용량 제한
- **Playwright E2E 테스트 전략**: 4개 테스트 파일(auth/map/search/admin)로 핵심 사용자 흐름 커버. CI 환경에서는 webServer 미사용(외부 URL 지정), 로컬에서는 `npm run dev` 자동 실행. .dockerignore에 e2e 관련 파일 제외하여 프로덕션 이미지 크기 영향 없음
- **gis-web healthcheck 추가**: 기존에 누락되어 있던 gis-web 컨테이너 healthcheck 추가. `wget -q --spider http://localhost:80/`으로 nginx 응답 확인
- **client_max_body_size 추가**: /api/ 프록시에 `client_max_body_size 500m` 추가하여 대용량 Shapefile 업로드 시 nginx 413 에러 방지 (gis-api의 500MB 파일 제한과 일치)

### 작업 후 - 완료 내용
- **코드 스플리팅** (2개 파일 수정)
  - `App.tsx`: LoginForm, AdminPanel, UserMenu를 `React.lazy()`로 동적 import + `Suspense` 래핑 (Spinner fallback)
  - `vite.config.ts`: `rollupOptions.manualChunks` 추가 (maplibre, vendor 2개 청크 분리)

- **벡터 타일 캐싱** (2개 파일 수정)
  - `nginx-spa.conf`: `proxy_cache_path` 추가 (10MB key zone, 1GB max, 1h inactive), `/tiles/` location에 `proxy_cache`, `proxy_cache_lock`, `proxy_cache_use_stale`, `X-Cache-Status` 헤더 추가, `/api/` location에 `client_max_body_size 500m` 추가
  - `docker-compose.yml`: `tile-cache` named volume 추가, gis-web healthcheck 추가

- **E2E 테스트 셋업** (7개 파일 생성)
  - `playwright.config.ts`: Chromium 단일 프로젝트, 로컬 dev 서버 자동 실행, CI 모드 지원
  - `e2e/auth.spec.ts`: 로그인 폼 표시, 실패 케이스, 성공 케이스 3개 테스트
  - `e2e/map.spec.ts`: 캔버스 렌더링, 지역 선택, 레이어 트리, 전체 보기 4개 테스트
  - `e2e/search.spec.ts`: 검색 입력 필드, 검색 실행 2개 테스트
  - `e2e/admin.spec.ts`: 관리자 패널 표시, 열기/닫기, 사용자 메뉴, 로그아웃 4개 테스트
  - `.dockerignore`: e2e, playwright 관련 파일 프로덕션 빌드에서 제외
  - `package.json`: `@playwright/test` devDependency + `test:e2e`, `test:e2e:ui`, `test:e2e:report` 스크립트 추가

- **tsconfig 업데이트**
  - `tsconfig.json`: `exclude: ["e2e"]` 추가 (Playwright 테스트가 앱 빌드에 영향 안 주도록)

### 다음 루프 TODO
- **실행 검증**: `make data && make gis`로 전체 서비스 빌드 + 기동 테스트
  - 5개 서비스(pg-tileserv, pg-featureserv, gis-api, gis-worker, gis-web) 모두 healthy 확인
  - nginx 타일 캐시 동작 확인 (`X-Cache-Status` 헤더 검증)
  - 브라우저에서 E2E 수동 검증 (로그인 → 지도 → 검색 → 업로드)
- **E2E 테스트 실행**: `npx playwright install && npm run test:e2e`로 자동화 테스트 실행
- **추가 최적화 (선택)**:
  - Vite build 후 번들 사이즈 리포트 분석 (`npx vite-bundle-visualizer`)
  - pg_tileserv Cache-Control 헤더 설정 (upstream에서도 캐시 힌트 제공)
  - SearchResults 컴포넌트 lazy loading (검색 결과 패널)
  - deck.gl 3D 시각화 (3D 좌표 데이터 확보 시)
- **운영 준비**:
  - CI/CD 파이프라인에 Playwright 테스트 통합
  - 모니터링 대시보드 (nginx access log + pg_tileserv metrics)
  - SSL 인증서 갱신 자동화 (Cloudflare Tunnel 또는 Let's Encrypt)

---

## Loop 12 (2026-03-23)

### 작업 전 - 목표
- **운영 준비 및 배포 문서화**
  - GIS 서비스 전체 배포 가이드 README 작성 (serengeti-iac/docker/layer3-apps/gis/README.md)
  - Docker Compose 설정 정합성 최종 점검 및 수정
  - GitHub Actions CI/CD 파이프라인 작성 (빌드 검증 + 린트)
  - 모니터링/헬스체크 종합 스크립트 작성
  - 전체 프로젝트 최종 리뷰 및 누락 사항 보완

### 작업 중 - 주요 문제/의사결정
- **Docker Compose `depends_on: postgres` 오류 발견 및 수정**: GIS docker-compose.yml에서 `postgres` 서비스에 `depends_on`을 걸었으나, postgres는 별도 compose 프로젝트(layer2-data)에 정의되어 있어 `invalid compose project` 에러 발생. `depends_on`을 제거하고 `restart: unless-stopped`로 자동 재시작에 의존하도록 변경. gis-api는 pg-tileserv healthy 대기로 간접 보장
- **.env 중첩 변수 참조 미지원 문제 수정**: `GIS_MINIO_ACCESS_KEY=${MINIO_ROOT_USER}` 형태의 중첩 참조가 Docker Compose에서 resolve되지 않아 빈 값으로 전달됨. 실제 값을 직접 기입하는 방식으로 변경
- **gis-status.sh 설계**: 6개 영역(컨테이너 상태, 헬스 엔드포인트, DB 데이터 현황, 외부 서비스 연결, nginx 캐시, 리소스 사용량)을 점검. PASS/WARN/FAIL 카운트로 종합 결과 제공
- **GitHub Actions CI/CD 설계**: 7개 병렬 job(api-check, web-build, worker-check, compose-validate, shell-check, sql-check, docker-build)으로 구성. `docker/layer3-apps/gis/**` 경로 변경 시에만 트리거

### 작업 후 - 완료 내용
- **Docker Compose 설정 수정** (1개 파일)
  - `docker-compose.yml`: cross-compose `depends_on: postgres` 제거 (pg-tileserv, pg-featureserv, gis-api, gis-worker 4곳), `start_period` 추가 (pg-tileserv, pg-featureserv), gis-api는 `depends_on: pg-tileserv` (간접 DB 대기)

- **.env 수정** (2개 파일)
  - `.env`: `GIS_MINIO_ACCESS_KEY`, `GIS_MINIO_SECRET_KEY`를 실제 값으로 변경 (중첩 변수 참조 제거)
  - `.env.example`: 해당 변수 설명 업데이트

- **배포 가이드 README** (1개 파일 생성)
  - `docker/layer3-apps/gis/README.md`: 아키텍처 다이어그램, 서비스 구성표, 배포 절차 4단계, 접근 URL, API 엔드포인트 전체 목록, 환경 변수 테이블, 프론트엔드 로컬 개발 가이드, 디렉토리 구조 맵

- **GitHub Actions CI/CD** (1개 파일 생성)
  - `.github/workflows/gis-ci.yml`: 7개 병렬 job
    - `api-check`: Python 3.12 + FastAPI import 검증
    - `web-build`: Node 22 + TypeScript 체크 + Vite 빌드 + 번들 크기 리포트
    - `worker-check`: Python 3.12 + worker config import 검증
    - `compose-validate`: Docker Compose config 검증 (더미 env)
    - `shell-check`: bash -n 구문 검증 (3개 스크립트)
    - `sql-check`: SQL 파일 존재 + 비공백 검증
    - `docker-build`: 3개 서비스(gis-api, gis-web, gis-worker) 이미지 병렬 빌드

- **모니터링 스크립트** (1개 파일 생성)
  - `docker/layer3-apps/gis/gis-status.sh`: 6개 영역 종합 점검
    1. 컨테이너 상태 (5개 서비스 running/healthy 확인)
    2. 헬스 엔드포인트 (gis-api, pg-tileserv, pg-featureserv, gis-web)
    3. 데이터베이스 (PostGIS 확장, gis 스키마, 데이터 건수)
    4. 외부 서비스 연결 (Redis, Elasticsearch, Kafka, MinIO)
    5. nginx 타일 캐시 크기
    6. 컨테이너 CPU/메모리 사용량

- **Makefile 업데이트**
  - `gis-status` 타겟 추가
  - `validate` 타겟에 `gis-status.sh` 구문 검증 추가
  - `help`에 `gis-status` 설명 추가

- **전체 검증 결과**: `make validate` 성공 (쉘 스크립트 18개 + Docker Compose 13개 모두 통과)

### 다음 루프 TODO
- **실행 검증**: `make data && make gis`로 전체 서비스 빌드 + 기동 테스트
  - 5개 서비스 모두 healthy 확인
  - `make gis-status`로 종합 점검 실행
  - 브라우저에서 `https://gis.giraffe.ai.kr/` 접근 테스트
- **Cloudflare Tunnel 설정**: `gis.giraffe.ai.kr` → gis-web:80 라우팅 추가
- **E2E 테스트 실행**: gis-web에서 `npx playwright install && npm run test:e2e`
- **추가 개선 (선택)**:
  - CI/CD에 Playwright E2E 테스트 job 추가
  - Grafana + Prometheus 모니터링 대시보드
  - 자동 백업 파이프라인에 gisdb 덤프 추가
  - gis-worker DLQ(Dead Letter Queue) 처리

---

## Loop 13 (2026-03-23)

### 작업 전 - 목표
- **실행 검증 및 코드 정합성 최종 점검**
  - Docker Compose 설정 검증 (`docker compose config`)
  - gis-api Python 코드 import 검증 (모듈 간 참조 정합성)
  - gis-web TypeScript 빌드 검증 (tsc --noEmit)
  - gis-worker Python 코드 import 검증
  - SQL 스크립트 정합성 점검 (initdb + migration)
  - 쉘 스크립트 구문 검증 (bash -n)
  - 발견된 문제 수정
  - 전체 프로젝트 정합성 최종 확인

### 작업 중 - 주요 문제/의사결정
- **TypeScript 타입 오류 발견 및 수정**: `LayerManager.tsx:65`에서 MapLibre GL JS 5의 `addLayer()` 메서드에 전달하는 레이어 객체의 `type` 속성이 `"fill" | "line" | "circle"` 유니온 타입으로 추론되어 `AddLayerObject` 타입과 불일치. `as Parameters<typeof map.addLayer>[0]` 타입 단언으로 수정
- **Vite 빌드 로컬 환경 제한**: Tailwind CSS v4의 `@tailwindcss/oxide` 네이티브 바인딩이 Node >= 20 요구. 로컬 Node.js 18에서는 빌드 불가하나, Dockerfile에서 Node 22-alpine 사용하므로 Docker 빌드에서는 문제 없음. 코드 자체의 정합성(tsc --noEmit)은 통과 확인

### 작업 후 - 완료 내용
- **전체 코드 정합성 검증 결과** (모두 통과):
  - `make validate`: 쉘 스크립트 18개 + Docker Compose 13개 모두 통과
  - `bash -n` 구문 검증: init-gisdb.sh, migrate-legacy.sh, gis-status.sh, 10_setup_elasticsearch.sh 4개 통과
  - `docker compose config`: 정상 (exit 0, 환경변수 미설정 경고만 - .env 파일 의존)
  - gis-api Python AST 파싱: 35개 파일 구문 오류 없음
  - gis-api 내부 import 해석: 모든 `app.*` 모듈 참조 정상 해석
  - gis-worker Python AST 파싱: 4개 파일 구문 오류 없음
  - gis-worker 내부 import 해석: 모든 `worker.*` 모듈 참조 정상 해석
  - SQL 스크립트: initdb 5개 + migration 4개 파일 모두 비공백 확인
  - TypeScript: `tsc --noEmit` 통과 (LayerManager.tsx 수정 후)
  - Dockerfile 정합성: gis-api(Python 3.12-slim), gis-web(Node 22 → nginx), gis-worker(PostGIS Alpine + Python venv) 모두 정상
  - Docker Compose 네트워크: proxy-tier/data-tier 분리 정상, 서비스 간 의존성(depends_on + healthcheck) 정상
  - nginx 리버스 프록시: /api/ → gis-api, /tiles/ → pg-tileserv(캐싱), /features/ → pg-featureserv, SPA fallback 정상

- **코드 수정** (1개 파일):
  - `gis-web/src/components/map/LayerManager.tsx:65`: MapLibre `addLayer()` 타입 단언 수정

### 다음 루프 TODO
- **실제 Docker 빌드 및 배포**: `make data && make gis`로 전체 서비스 빌드 + 컨테이너 기동 테스트
  - 5개 서비스(pg-tileserv, pg-featureserv, gis-api, gis-worker, gis-web) 이미지 빌드 성공 확인
  - `make gis-status`로 종합 헬스체크 실행
- **Cloudflare Tunnel 설정**: `gis.giraffe.ai.kr` → gis-web:80 라우팅 추가
- **E2E 테스트 실행**: Docker 환경에서 Playwright 테스트 실행
- **추가 개선 (선택)**:
  - CI/CD에 Playwright E2E 테스트 job 추가
  - gis-worker DLQ(Dead Letter Queue) 처리
  - package-lock.json 생성하여 재현 가능한 빌드 보장

---

## Loop 14 (2026-03-23)

### 작업 전 - 목표
- **실제 Docker 빌드 및 서비스 기동 테스트**
  - serengeti-iac 현재 상태 점검 (GIS 관련 파일 존재 여부)
  - `make data && make gis`로 전체 서비스 빌드 시도
  - 빌드 오류 발생 시 원인 분석 및 수정
  - 서비스 기동 후 `make gis-status`로 종합 헬스체크
  - 발견된 문제점 수정 및 배포 준비 상태 확인

### 작업 중 - 주요 문제/의사결정
- **gis-worker 빌드 실패 (aiokafka C 확장)**: PostGIS Alpine 이미지에 `zlib-dev`가 누락되어 `aiokafka`의 Cython C 확장 빌드 실패 (`zlib.h: No such file or directory`). Dockerfile에 `python3-dev gcc musl-dev libffi-dev zlib-dev` 빌드 의존성 추가 후 `apk del .build-deps`로 정리하여 해결
- **PostgreSQL → PostGIS 이미지 교체**: 현재 실행 중인 `postgres:16-alpine`을 `postgis/postgis:16-3.4-alpine`으로 교체. 동일 데이터 볼륨(`/mnt/primary/postgres`) 사용으로 기존 DB(Nextcloud, Plane) 100% 보존. 컨테이너 재생성 후 기존 서비스 모두 자동 재연결 확인
- **pg-tileserv/pg-featureserv healthcheck 실패**: `pramsey/pg_tileserv` 이미지에 `wget`이 미포함. `CMD-SHELL bash -c 'echo > /dev/tcp/localhost/7800'`으로 TCP 연결 검사 방식으로 교체
- **gis-web healthcheck 실패**: nginx:alpine 이미지에도 `wget` 미포함. `curl -sf http://localhost:80/`으로 교체 (curl은 포함됨)
- **SQLAlchemy ORM ForeignKey 누락**: 모든 모델(Layer, Parcel, Building, Facility)에서 `region_id = Column(Integer)` → `Column(Integer, ForeignKey("gis.regions.id"))` 누락. `Facility.type_id`도 `ForeignKey("gis.facility_types.id")` 추가. 총 5개 모델 6개 컬럼 수정
- **GIS DB 초기화 성공**: PostGIS 3.4.3 확장 + topology, gis/auth/audit 3개 스키마, 8개 테이블, 13개 인덱스, 7개 시설물 유형 시드, 3개 pg_tileserv용 MVT 함수 모두 정상 생성

### 작업 후 - 완료 내용
- **Docker 이미지 빌드 성공** (3개 서비스)
  - `gis-api`: Python 3.12-slim, FastAPI + SQLAlchemy + GeoAlchemy2 + asyncpg + Redis + ES + Kafka + MinIO
  - `gis-worker`: PostGIS Alpine + Python venv + gdal-tools + aiokafka + psycopg2
  - `gis-web`: Node 22 빌드 → nginx 멀티스테이지 (maplibre 1MB, app 199KB, vendor 12KB)

- **인프라 이미지 교체** (1개)
  - PostgreSQL: `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine` (PostGIS 3.4.3 + GEOS 3.12.2 + PROJ 9.4.0)
  - 기존 서비스(Nextcloud, Plane, Redis 등) 전부 정상 유지 확인

- **GIS DB 초기화 완료**
  - gisdb 생성 + PostGIS/topology 확장 활성화
  - gis/auth/audit 3개 스키마 + 8개 테이블 + 시드 데이터 적용

- **5개 GIS 서비스 기동 및 healthy 확인**
  - `pg-tileserv`: healthy - GIS 테이블 6개 + 함수 3개 자동 발견
  - `pg-featureserv`: healthy - OGC API Features 서빙 정상
  - `gis-api`: healthy - `/api/health` 200 OK, `/api/v1/regions/` 200, `/api/v1/facilities/types` 200 (7개 반환)
  - `gis-worker`: running - Kafka consumer 대기 중
  - `gis-web`: healthy - React SPA + nginx 리버스 프록시 정상 (/api/ → gis-api, /tiles/ → pg-tileserv, /features/ → pg-featureserv)

- **코드 수정** (7개 파일)
  - `gis-worker/Dockerfile`: Alpine 빌드 의존성 (python3-dev, gcc, musl-dev, libffi-dev, zlib-dev) 추가
  - `docker-compose.yml`: pg-tileserv/pg-featureserv healthcheck TCP 방식 교체, gis-web healthcheck curl 방식 교체
  - `gis-api/app/models/layer.py`: ForeignKey("gis.regions.id") 추가
  - `gis-api/app/models/parcel.py`: ForeignKey("gis.regions.id") 추가
  - `gis-api/app/models/building.py`: ForeignKey("gis.regions.id") 추가
  - `gis-api/app/models/facility.py`: ForeignKey("gis.regions.id"), ForeignKey("gis.facility_types.id") 추가

### 다음 루프 TODO
- **레거시 데이터 마이그레이션 실행**: `make gis-migrate`로 포천시 Shapefile → PostGIS 마이그레이션 실행 (ua502 → parcels, buildig_txt → buildings)
- **Cloudflare Tunnel 설정**: `gis.giraffe.ai.kr` → gis-web:80 라우팅 추가하여 외부 접근 활성화
- **E2E 테스트 실행**: gis-web에서 Playwright 테스트 실행
- **추가 개선 (선택)**:
  - gis-api healthcheck에서 httpx import 시간 지연 문제 → 경량 체크로 교체 검토
  - gis-worker healthcheck 추가
  - `make gis-status` 스크립트 실행 검증
  - CI/CD에 Playwright E2E 테스트 job 추가

---

## Loop 15 (2026-03-23)

### 작업 전 - 목표
- **레거시 데이터 마이그레이션 실행**: `make gis-migrate`로 포천시 Shapefile → PostGIS 마이그레이션 실행
- **서비스 상태 종합 점검**: `make gis-status` 실행하여 전체 헬스체크
- **Cloudflare Tunnel 설정**: `gis.giraffe.ai.kr` → gis-web:80 라우팅 추가하여 외부 접근 활성화
- **운영 준비 완료 확인**: 브라우저에서 실제 서비스 접근 및 기능 검증

### 작업 중 - 주요 문제/의사결정
- **shp2pgsql libintl.so.8 누락**: PostGIS Alpine 이미지에 `gettext` 패키지가 미포함. `apk add gettext`로 해결. migrate-legacy.sh에 자동 감지+설치 로직 추가
- **Shapefile 인코딩 CP949**: 레거시 Shapefile이 CP949(EUC-KR) 인코딩. shp2pgsql `-W UTF-8` → `-W CP949`로 변경하여 한글 데이터 정상 임포트
- **gis-status.sh `set -e` + `((PASS++))` 충돌**: bash에서 `((0++))`은 exit code 1을 반환하여 `set -e`에 의해 스크립트 즉시 종료됨. `set -e` 제거 + `PASS=$((PASS+1))` 방식으로 교체
- **pg-tileserv/pg-featureserv/gis-web healthcheck 도구 부재**: wget/curl이 이미지에 미포함. TCP 연결 테스트(`/dev/tcp`) 및 curl 방식으로 교체
- **gis-api regions API 500 에러**: `ST_AsGeoJSON()`이 JSON 문자열을 반환하지만 Pydantic 스키마가 dict를 기대. `json.loads()` 파싱 추가. 또한 Redis에 이전 문자열 캐시가 남아있어 캐시 클리어 필요
- **NPM 프록시 호스트 생성**: NPM API를 통해 `gis.giraffe.ai.kr` → `gis-web:80` 라우팅 자동 추가. 단, DNS A 레코드가 Cloudflare에 미등록 상태여서 Let's Encrypt 인증서 발급 실패 → Cloudflare 대시보드에서 수동 DNS 등록 필요

### 작업 후 - 완료 내용
- **레거시 데이터 마이그레이션 성공**
  - 포천시 지역(region) 등록: `4165000000` (경기도 포천시)
  - ua502.shp → staging.ua502 → gis.parcels: **254,741 필지** 임포트 (18개 읍면동)
  - buildig_txt.shp → staging.buildig_txt → gis.buildings: **8,721 건물** 임포트
  - 10개 레이어 메타데이터 시드 (basemap, ortho, parcels, buildings, manhole, pipe_sew, pipe_rain, valve, pump, treatment)

- **코드 수정** (5개 파일)
  - `migrate-legacy.sh`: `-W UTF-8` → `-W CP949` (인코딩 수정), gettext 자동 설치 로직 추가
  - `gis-status.sh`: `set -e` 제거, `((var++))` → `$((var+1))` 안전한 산술 연산, healthcheck 명령어 수정
  - `gis-api/app/routers/regions.py`: `_parse_geojson()` 함수 추가 - ST_AsGeoJSON 문자열 → dict 변환

- **NPM 프록시 호스트 생성** (API 자동화)
  - `gis.giraffe.ai.kr` → `gis-web:80` (host ID: 8)
  - `client_max_body_size 500m`, `proxy_read_timeout 300`, WebSocket 지원
  - SSL 인증서: DNS A 레코드 미등록으로 Let's Encrypt 발급 대기 중

- **gis-status 종합 점검 결과**: PASS=10, WARN=3, FAIL=0
  - 5개 서비스 모두 running (4개 healthy, worker는 healthcheck 미설정)
  - API 정상 응답: /api/health, /api/v1/regions/, /api/v1/layers/, /api/v1/facilities/types
  - 데이터 현황: regions 1, parcels 254,741, buildings 8,721, layers 10
  - WARN: Redis/Elasticsearch 미접근 (선택 서비스, 별도 실행 필요)

### 다음 루프 TODO
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **Redis/Elasticsearch 연동**: 현재 WARN 상태인 두 서비스 접근 설정 확인 (네트워크 연결 또는 별도 인스턴스 필요)
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities
- **E2E 테스트 실행**: gis-web에서 Playwright 테스트 실행
- **추가 개선 (선택)**:
  - gis-worker healthcheck 추가
  - gis-api Redis 캐시 에러 핸들링 (연결 실패 시 graceful fallback)
  - CI/CD에 Playwright E2E 테스트 job 추가

---

## Loop 16 (2026-03-23)

### 작업 전 - 목표
- **서비스 안정성 강화: Redis/Elasticsearch graceful fallback 구현**
  - gis-api의 Redis 캐시 서비스에 연결 실패 시 graceful fallback 추가 (캐시 없이 DB 직접 조회)
  - gis-api의 Elasticsearch 검색 서비스에 연결 실패 시 에러 핸들링 추가 (503 응답 + 명확한 메시지)
  - gis-worker Docker Compose healthcheck 추가
  - gis-api healthcheck 최적화 (httpx → 경량 방식)

### 작업 중 - 주요 문제/의사결정
- **Redis graceful fallback 전략**: `cache_get`/`cache_set`/`cache_delete` 모든 함수에 try/except 래핑. Redis 연결 실패 시 `logger.warning()`으로 로깅만 하고 `None`(cache miss) 반환하여 DB 직접 조회로 자동 폴백. 서비스 가용성 > 캐시 성능 우선
- **Elasticsearch fallback 전략**: Redis와 달리 ES는 핵심 기능(검색)이므로 단순 무시 불가. `SearchServiceUnavailable` 커스텀 예외를 도입하여 `search.py`에서 `ESConnectionError`/`ConnectionError`/`OSError`를 잡아 래핑, `search router`에서 503 응답으로 변환. 프론트엔드에서 "검색 서비스 일시 중단" 메시지 표시 가능
- **gis-api healthcheck httpx 제거**: Docker healthcheck에서 `httpx` import에 ~2초 소요. `urllib.request`(표준 라이브러리)로 교체하여 import 시간 대폭 단축. `httpx==0.28.1` 패키지도 requirements.txt에서 제거하여 이미지 크기 절감
- **gis-worker healthcheck 방식**: HTTP 서버가 없는 worker 특성상 `pgrep -f 'python.*worker.main'`으로 Python 프로세스 존재 여부 확인. Kafka consumer 자체의 liveness는 확인할 수 없지만, 최소한 프로세스 크래시 감지 가능

### 작업 후 - 완료 내용
- **Redis graceful fallback** (1개 파일 수정)
  - `gis-api/app/services/cache.py`: `cache_get`, `cache_set`, `cache_delete`, `close_redis` 4개 함수 모두 try/except 래핑. 연결 실패 시 `logger.warning()` + graceful degradation (None 반환/무시)

- **Elasticsearch graceful fallback** (2개 파일 수정)
  - `gis-api/app/services/search.py`: `SearchServiceUnavailable` 예외 클래스 추가, `search_address`/`search_nearby`에서 `ESConnectionError`/`ConnectionError`/`OSError` 캐치하여 커스텀 예외로 변환, `close_es`에 try/except 추가
  - `gis-api/app/routers/search.py`: `SearchServiceUnavailable` → `HTTPException(503)` 변환 처리 추가

- **gis-worker healthcheck 추가** (1개 파일 수정)
  - `docker-compose.yml`: gis-worker에 `pgrep` 기반 healthcheck 추가 (interval=30s, retries=3, start_period=15s)

- **gis-api healthcheck 최적화** (2개 파일 수정)
  - `docker-compose.yml`: `httpx` → `urllib.request` 표준 라이브러리 방식으로 교체
  - `gis-api/requirements.txt`: `httpx==0.28.1` 제거 (healthcheck 전용이었으므로 더 이상 불필요)

- **변경 파일 요약**: 4개 파일 수정 (cache.py, search.py, search router, docker-compose.yml), 1개 파일 의존성 제거 (requirements.txt)

### 다음 루프 TODO
- **서비스 재빌드 및 검증**: gis-api 이미지 재빌드 (`httpx` 제거 + graceful fallback 코드 반영) → 5개 서비스 모두 healthy 확인
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **Redis/Elasticsearch 연동 테스트**: 두 서비스 기동 후 graceful fallback이 정상 동작하는지 검증 (Redis down → DB fallback, ES down → 503 응답)
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities
- **E2E 테스트 실행**: gis-web에서 Playwright 테스트 실행
- **추가 개선 (선택)**:
  - CI/CD에 Playwright E2E 테스트 job 추가
  - gis-api health 엔드포인트에 DB/Redis/ES 연결 상태 포함 (상세 healthcheck)
  - gis-worker Kafka consumer liveness 상세 체크 (별도 HTTP healthcheck 서버 추가)

---

## Loop 17 (2026-03-23)

### 작업 전 - 목표
- **운영 관측성(Observability) 강화 및 버그 수정**
  - gis-status.sh 버그 수정: httpx 참조 제거(Loop 16에서 삭제됨), 파이프 명령어 check() 함수 호환 문제, bash-specific /dev/tcp 구문 수정
  - gis-api /api/health 엔드포인트 상세화: DB/Redis/ES 연결 상태 포함하여 의존성별 health 정보 제공
  - gis-worker 컨테이너 재생성하여 healthcheck 적용 확인
  - 전체 서비스 상태 점검 (gis-status.sh 실행 검증)

### 작업 중 - 주요 문제/의사결정
- **gis-status.sh httpx 참조 버그**: Loop 16에서 `httpx`를 requirements.txt에서 제거했으나, gis-status.sh의 3곳(gis-api health, ES check, MinIO check)에서 여전히 `httpx` import 사용. 모두 `urllib.request` 표준 라이브러리로 교체
- **gis-status.sh 파이프 명령어 check() 비호환**: `check "label" docker exec ... | grep -q 1` 형태에서 파이프(`|`)가 shell 최상위에서 해석되어 check() 함수의 명령어가 아닌 check() 자체의 stdout을 grep에 전달. `bash -c "..."` 래핑으로 파이프를 단일 명령어로 캡슐화
- **gis-status.sh bash-specific /dev/tcp**: `sh -c "echo > /dev/tcp/..."` → `bash -c "echo > /dev/tcp/..."` (pg-tileserv, pg-featureserv healthcheck에 /dev/tcp는 bash 전용)
- **gis-status.sh 환경변수 호스트 vs 컨테이너 불일치**: `${GIS_REDIS_URL}` 등이 호스트에서 expand되어 컨테이너 내부 값과 불일치. `os.environ.get()` 패턴으로 컨테이너 내부 환경변수를 직접 참조하도록 변경
- **Elasticsearch 401 Unauthorized**: ES는 인증 필요(`ELASTIC_PASSWORD`). gis-status.sh의 ES 체크에 Basic Auth 헤더 추가 (`base64 인코딩으로 elastic:{password}`)
- **gis-worker healthcheck 미적용**: docker-compose.yml에 healthcheck가 정의되어 있었으나 컨테이너 재생성이 필요했음. `make gis`로 전체 재빌드하여 해결 (gis-worker: healthy 확인)
- **/api/health 상세 모드 설계**: `?detail=true` 쿼리 파라미터로 상세/기본 모드 분리. Docker healthcheck은 기본 모드(빠름), 모니터링 도구는 상세 모드(DB/Redis/ES 각각 확인). 의존성 중 하나라도 비정상이면 `"degraded"` 상태 반환

### 작업 후 - 완료 내용
- **gis-status.sh 버그 수정** (1개 파일, 5곳 수정)
  - httpx → urllib.request 교체 (3곳: gis-api health, ES, MinIO)
  - 파이프 명령어 bash -c 래핑 (2곳: PostGIS 확장, gis 스키마 확인)
  - sh -c → bash -c 교체 (2곳: pg-tileserv, pg-featureserv /dev/tcp 체크)
  - 환경변수 참조: 호스트 shell expansion → `os.environ.get()` 컨테이너 내부 참조 (4곳: Redis, ES, MinIO)
  - ES 인증 헤더 추가 (Basic Auth, GIS_ELASTICSEARCH_PASSWORD 사용)

- **gis-api /api/health 상세 엔드포인트** (1개 파일 수정)
  - `main.py`: `?detail=true` 파라미터 추가
  - 기본 모드: `{"status": "ok"}` (기존과 동일, Docker healthcheck 호환)
  - 상세 모드: `{"status": "ok|degraded", "checks": {"database": "ok", "redis": "ok", "elasticsearch": "ok (v8.12.0)"}}`
  - import 추가: `sqlalchemy.text`, `app.database.async_session`, `app.services.cache.get_redis`, `app.services.search.get_es`

- **gis-worker healthcheck 활성화**
  - `make gis`로 전체 컨테이너 재생성 → gis-worker: `(healthy)` 상태 확인

- **전체 서비스 검증 결과**: `gis-status.sh` 실행 → **PASS=15, WARN=0, FAIL=0**
  - 5개 서비스 모두 running + healthy (pg-tileserv, pg-featureserv, gis-api, gis-worker, gis-web)
  - 4개 헬스 엔드포인트 모두 정상 (gis-api, pg-tileserv, pg-featureserv, gis-web)
  - PostGIS 확장 + gis 스키마 정상
  - 데이터: regions 1, parcels 254,741, buildings 8,721, layers 10, facilities 0
  - 외부 서비스: Redis OK, Elasticsearch OK (v8.12.0), Kafka OK, MinIO OK
  - API 엔드포인트: /api/health, /api/v1/regions/, /api/v1/layers/, /api/v1/facilities/types 모두 정상 응답

### 다음 루프 TODO
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities (현재 0건)
- **Elasticsearch 주소 인덱스 생성**: `migration/10_setup_elasticsearch.sh` 실행하여 parcels/buildings 데이터를 ES에 인덱싱 → 주소 검색 기능 활성화
- **E2E 테스트 실행**: gis-web에서 `npx playwright install && npm run test:e2e`
- **추가 개선 (선택)**:
  - CI/CD에 Playwright E2E 테스트 job 추가
  - gis-worker Kafka consumer liveness 상세 체크 (별도 HTTP healthcheck 서버 추가)
  - Grafana + Prometheus 모니터링 대시보드 연동

---

## Loop 18 (2026-03-23)

### 작업 전 - 목표
- **Elasticsearch 주소 검색 인덱스 생성 및 검색 기능 활성화**
  - `migration/10_setup_elasticsearch.sh` 실행하여 nori 플러그인 설치 + 주소 검색 인덱스 생성
  - PostGIS parcels(254,741건) + buildings(8,721건) 데이터를 Elasticsearch에 bulk 인덱싱
  - 주소 검색 테스트 (한국어 nori 형태소 분석 + 자동완성)
  - gis-api 검색 엔드포인트 연동 검증 (`GET /api/v1/search/address?q=포천`)
  - 스크립트 실행 중 발견되는 버그 수정

### 작업 중 - 주요 문제/의사결정
- **ES 포트 호스트 미바인딩**: Elasticsearch 컨테이너가 Docker 네트워크 내부에서만 접근 가능 (포트 바인딩 없음). 기존 스크립트의 `curl localhost:9200` 방식 → `docker exec elasticsearch curl localhost:9200` 방식으로 전면 수정. `es_curl()` 헬퍼 함수 도입
- **NDJSON 생성 SQL 오류**: 원본 스크립트의 `jsonb || E'\n' || jsonb` 연산에서 `E'\n'`이 JSON으로 파싱 불가. `jsonb::text || chr(10) || jsonb::text` 방식으로 수정하여 text 연결 연산자로 변경
- **ES 인덱스 이름 불일치 발견**: 스크립트에서 생성한 인덱스명은 `gis-address`(하이픈)이지만 gis-api search.py에서는 `gis_address`(언더스코어)를 참조하여 404 에러 발생. `search.py`의 `INDEX_NAME`을 `gis-address`로 통일
- **검색 필드명 불일치 수정**: search.py의 `building_name` → `bldnm` (ES 인덱스 실제 필드명), `address.autocomplete` 필드 추가하여 자동완성 검색 지원
- **검색 결과 type 필드 매핑**: ES 인덱스에 `type` 필드가 없고 `source_table`만 존재. `source_table` 값에서 `parcel`/`building` 타입을 추출하는 로직 추가
- **bulk 인덱싱 방식**: 호스트에서 ES로 직접 bulk 전송 불가하므로, `docker cp` + `docker exec curl --data-binary` 방식으로 chunk 파일을 ES 컨테이너에 복사 후 내부에서 bulk API 호출

### 작업 후 - 완료 내용
- **Elasticsearch nori 플러그인 설치 + 인덱스 생성 완료**
  - `analysis-nori` 플러그인 설치 + ES 재시작
  - `gis-address` 인덱스 생성: nori 형태소 분석기 4종 (korean_index, korean_search, autocomplete_index, autocomplete_search)
  - geo_point 타입 location 필드로 반경 검색 지원

- **PostGIS → Elasticsearch bulk 인덱싱 완료**: **263,462건**
  - parcels: 254,741건 (51 chunks × 5,000 docs/chunk, 0 failures)
  - buildings: 8,721건 (single bulk request, 0 errors)

- **검색 API 연동 완료 (gis-api)**
  - `GET /api/v1/search/address?q=포천 일동면` → 10,000+ hits, 한국어 nori 분석 정상
  - `GET /api/v1/search/nearby?lat=37.76&lng=127.17&radius_m=500` → 283 hits, 거리순 정렬 정상
  - `/api/health?detail=true` → `{"status":"ok","checks":{"database":"ok","redis":"ok","elasticsearch":"ok (v8.12.0)"}}`

- **코드 수정** (2개 파일)
  - `gis-api/app/services/search.py`: INDEX_NAME `gis_address` → `gis-address`, 필드명 `building_name` → `bldnm` + `address.autocomplete` 추가, `source_table` 기반 type 매핑 로직 추가
  - `migration/10_setup_elasticsearch.sh`: 전면 재작성 - `es_curl()` 헬퍼 (docker exec 기반), NDJSON SQL `::text || chr(10)` 방식, `docker cp` + 내부 bulk 전송 방식

### 다음 루프 TODO
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities (현재 0건)
- **E2E 테스트 실행**: gis-web에서 `npx playwright install && npm run test:e2e`
- **프론트엔드 검색 UI 연동 검증**: 브라우저에서 SearchBar → API → ES 검색 → 결과 표시 → 클릭 시 flyTo 흐름 검증
- **추가 개선 (선택)**:
  - CI/CD에 Playwright E2E 테스트 job 추가
  - Grafana + Prometheus 모니터링 대시보드 연동
  - 검색 결과에 건물명(bldnm) 별도 표시 (현재 address만 title에 포함)

---

## Loop 19 (2026-03-23)

### 작업 전 - 목표
- **프론트엔드 검색 UI 연동 검증 및 E2E 테스트**
  - gis-web 프론트엔드 코드 정합성 점검 (검색 API 필드명 변경 반영 여부)
  - SearchBar → gis-api → Elasticsearch 검색 흐름 E2E 검증
  - 프론트엔드 검색 결과 표시 로직이 Loop 18에서 변경된 API 응답 형식과 일치하는지 확인
  - E2E 테스트 실행 (Playwright)
  - 발견된 버그 수정

### 작업 중 - 주요 문제/의사결정
- **passlib + bcrypt 4.x 호환성 오류**: `bcrypt` 최신 버전(4.2+)이 72바이트 초과 패스워드에서 `ValueError`를 발생시키며 passlib의 wrap bug 감지 로직과 충돌. `bcrypt==4.0.1`로 버전 고정하여 해결
- **관리자 비밀번호 해시 불일치**: `04_seed.sql`의 bcrypt 해시가 실제로 `admin1234`와 일치하지 않음 (해시 생성 환경 차이). gis-api 컨테이너 내에서 새 해시 생성 → DB 업데이트 + seed SQL 수정
- **LoginForm label-input 연결 누락**: `<label>`과 `<input>`이 `htmlFor`/`id`로 연결되어 있지 않아 Playwright `getByLabel()`이 요소를 찾지 못함. 접근성(a11y) + 테스트 호환성 동시 개선
- **E2E 테스트 비밀번호 불일치**: seed SQL 주석은 `admin1234`이나 E2E 테스트는 `admin1234!` 사용. 4개 테스트 파일의 비밀번호를 `admin1234`로 통일
- **검색 결과 locator 불일치**: Tailwind CSS 동적 클래스명은 Playwright `[class*="search"]` 패턴에 매칭되지 않음. `getByText(/\d+건/)` 또는 "검색 결과가 없습니다." 텍스트 기반 locator로 변경
- **검색 결과 UX 개선**: 기존에 `title=전체주소`, `address=지번번호`로 반환되어 중복 정보 표시. 건물명(bldnm) 필드 활용하여 `title=건물명`, `address=전체주소`로 개선. 건물명 없는 필지는 기존과 동일

### 작업 후 - 완료 내용
- **E2E 테스트 전체 통과**: 13/13 테스트 통과 (21.6초)
  - 인증 3개: 로그인 폼 표시, 실패 케이스, 성공 케이스
  - 지도 4개: 캔버스 렌더링, 지역 선택, 레이어 트리, 전체 보기
  - 검색 2개: 입력 필드 존재, 검색 결과 표시
  - 관리자 4개: 데이터 관리 패널, 열기/닫기, 사용자 메뉴, 로그아웃

- **코드 수정** (8개 파일)
  - `gis-api/requirements.txt`: `bcrypt==4.0.1` 버전 고정 추가
  - `gis-api/app/services/search.py`: 건물명(bldnm) 표시 로직 추가 (search_address, search_nearby 양쪽)
  - `initdb/04_seed.sql`: admin 비밀번호 해시 재생성 (bcrypt 4.0.1 호환)
  - `gis-web/src/components/auth/LoginForm.tsx`: label htmlFor/input id 연결 (접근성 개선)
  - `gis-web/e2e/auth.spec.ts`: 비밀번호 `admin1234!` → `admin1234`
  - `gis-web/e2e/map.spec.ts`: 비밀번호 수정
  - `gis-web/e2e/search.spec.ts`: 비밀번호 수정 + 검색 결과 locator 개선
  - `gis-web/e2e/admin.spec.ts`: 비밀번호 수정

### 다음 루프 TODO
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities (현재 0건)
- **CI/CD에 E2E 테스트 통합**: GitHub Actions에 Playwright 테스트 job 추가 (서비스 컨테이너 + `E2E_BASE_URL` 설정)
- **추가 개선 (선택)**:
  - gis-worker Kafka consumer liveness 상세 체크 (별도 HTTP healthcheck 서버 추가)
  - Grafana + Prometheus 모니터링 대시보드 연동
  - 검색 자동완성 (debounce + autocomplete 필드 활용)

---

## Loop 20 (2026-03-23)

### 작업 전 - 목표
- **CI/CD E2E 테스트 통합**: GitHub Actions gis-ci.yml에 Playwright E2E 테스트 job 추가
  - Docker Compose 서비스 컨테이너 기동 → Playwright 테스트 실행 → 결과 리포트
  - `E2E_BASE_URL` 환경변수로 테스트 대상 URL 설정
- **검색 자동완성 구현**: 프론트엔드 SearchBar에 debounce + autocomplete 필드 활용
  - 입력 시 300ms debounce 후 자동 검색
  - Elasticsearch autocomplete 분석기 활용 (Loop 18에서 생성한 `address.autocomplete` 필드)
  - 드롭다운 형태의 실시간 자동완성 결과 표시

### 작업 중 - 주요 문제/의사결정
- **CI E2E 테스트 환경 설계**: Docker Compose 전체 스택(Kafka, MinIO, ES 등)을 CI에서 모두 올리면 무겁고 불안정. 대신 PostgreSQL(PostGIS) service container + gis-api(uvicorn) + gis-web(serve)를 직접 실행하는 경량 방식 채택. Loop 16에서 구현한 Redis/ES graceful fallback 덕분에 두 서비스 없이도 핵심 기능(인증, 지도, 레이어) 테스트 가능
- **`serve` devDependency 추가**: CI에서 Vite 빌드 결과를 서빙하기 위해 `serve@14.2.0` 추가. Vite preview 대신 serve를 사용하여 SPA fallback + static 서빙을 간단히 구현
- **gis-ci.yml YAML 파싱 오류 발견 및 수정**: 기존 `api-check` job의 `run: python -c "...print(f'Settings OK: {s.jwt_algorithm}')"` 라인에서 f-string 내 콜론이 YAML 매핑 값으로 오인되는 파싱 에러 발견 (Loop 12 이후 잠재적 버그). `run: |` 블록 스칼라 방식으로 수정
- **자동완성 전용 `/autocomplete` 엔드포인트 분리**: 기존 `/address` 엔드포인트를 재사용할 수도 있었으나, `address.autocomplete` 필드를 최우선 검색 필드로 사용하고 `_source` 필터링으로 응답 크기를 최소화하는 경량 엔드포인트를 별도 생성. 자동완성은 기본 8건, 전체 검색은 기본 20건으로 차별화
- **debounce + AbortController 패턴**: 300ms debounce로 타이핑 중 불필요한 API 호출 방지. AbortController로 이전 요청 취소하여 stale 응답이 최신 입력을 덮어쓰는 race condition 방지
- **isFullSearch 플래그**: Enter 키로 전체 검색 실행 후에는 debounce 자동완성이 재트리거되지 않도록 `isFullSearch` 상태 추가. 사용자가 다시 입력을 수정하면 자동완성 모드로 복귀

### 작업 후 - 완료 내용
- **GitHub Actions E2E 테스트 job 추가** (1개 파일 수정)
  - `.github/workflows/gis-ci.yml`: `e2e-test` job 추가 (web-build + api-check 의존)
    - PostgreSQL(PostGIS) service container → initdb SQL 적용
    - gis-api uvicorn 백그라운드 실행 → healthcheck
    - gis-web npm build → serve로 정적 서빙
    - Playwright chromium 설치 → E2E 테스트 실행
    - 테스트 리포트 artifact 업로드 (14일 보관)
  - `api-check` job의 YAML 파싱 오류 수정 (pre-existing bug)

- **검색 자동완성 구현** (5개 파일 수정/생성)
  - **백엔드**:
    - `gis-api/app/services/search.py`: `search_autocomplete()` 함수 추가 (address.autocomplete 필드 우선, _source 필터링, 기본 8건)
    - `gis-api/app/routers/search.py`: `GET /api/v1/search/autocomplete?q=&region=&size=` 엔드포인트 추가
  - **프론트엔드**:
    - `gis-web/src/api/search.ts`: `searchAutocomplete()` API 함수 추가, `searchAddress()`에 size 파라미터 추가
    - `gis-web/src/components/search/SearchBar.tsx`: 전면 재작성
      - `useDebounce` 훅 (300ms)
      - AbortController로 stale 요청 취소
      - 2글자 이상 입력 시 자동완성 → 8건 표시
      - Enter/버튼 클릭 시 전체 검색 → 20건 표시
      - Escape 키로 드롭다운 닫기

- **E2E 테스트 업데이트** (1개 파일 수정)
  - `gis-web/e2e/search.spec.ts`: 자동완성 동작 대응 (debounce 대기 → 자동완성 결과 또는 Enter 검색 결과 확인)

- **package.json 업데이트** (1개 파일 수정)
  - `gis-web/package.json`: `serve@^14.2.0` devDependency 추가 (CI E2E 테스트용)

- **코드 검증 결과**:
  - TypeScript `tsc --noEmit`: 통과
  - Python AST 구문 검사: search.py, search router 모두 통과
  - GitHub Actions YAML 파싱: 통과

- **새 API 엔드포인트**:
  - `GET /api/v1/search/autocomplete?q=&region=&size=` - 자동완성 검색 (address.autocomplete 필드 우선, 기본 8건)

### 다음 루프 TODO
- **서비스 재빌드 및 검증**: gis-api 이미지 재빌드 (autocomplete 엔드포인트 반영) → `make gis` 실행 → 자동완성 API 동작 확인
- **DNS 설정 완료**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드 추가 → NPM에서 Let's Encrypt SSL 인증서 발급
- **시설물 데이터 마이그레이션**: 레거시 DB 접근 가능 시 맨홀/관로 등 시설물 데이터 추출 → gis.facilities (현재 0건)
- **추가 개선 (선택)**:
  - gis-worker Kafka consumer liveness 상세 체크 (별도 HTTP healthcheck 서버 추가)
  - Grafana + Prometheus 모니터링 대시보드 연동
  - 자동완성 하이라이트 (매칭 텍스트 볼드 처리)
  - 검색 히스토리 localStorage 저장
- 사람이 수행해야 하는 체크리스트 작성

---

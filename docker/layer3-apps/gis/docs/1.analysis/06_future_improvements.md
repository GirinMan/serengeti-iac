# 06. 향후 개선 로드맵 (Future Improvements)

> Loop 1~20 작업 이력 및 분석 문서(01~05) 기반으로 정리.
> 현재 구현 완료된 항목(Phase 0~3)을 제외하고, **아직 미구현이거나 추가 개선이 필요한 항목**을 체계적으로 분류.

---

## 현재 완료 상태 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 0 | PostGIS 이미지 교체, GIS DB 스키마, Docker Compose | 완료 (Loop 5) |
| Phase 1 | 레거시 데이터 마이그레이션 (parcels 254,741 + buildings 8,721) | 완료 (Loop 15) |
| Phase 2 | FastAPI 백엔드 + gis-worker + Kafka/MinIO 수집 파이프라인 | 완료 (Loop 7~8) |
| Phase 3 | React 19 + MapLibre GL JS 프론트엔드 + E2E 테스트 13개 통과 | 완료 (Loop 9~11, 19~20) |
| 운영 준비 | gis-status.sh, CI/CD, README, graceful fallback, autocomplete | 완료 (Loop 12~20) |

---

## 1. 단기 개선 (1~2주)

### 1-1. 시설물 데이터 마이그레이션
- **현재**: `gis.facilities` 테이블 0건. 맨홀/관로/밸브/펌프/처리시설 데이터 없음
- **원인**: 시설물 원본 Shapefile이 코드베이스에 존재하지 않음 (Loop 6 확인)
- **대안**:
  - A. 레거시 PostgreSQL 9.2 DB 직접 연결 → 시설물 테이블 덤프 (DB 접근권한 필요)
  - B. 기존 정적 MVT 타일에서 Feature 역추출 (tippecanoe-decode)
  - C. 포천시/용역사로부터 원본 SHP 파일 수급
- **영향**: 시설물 레이어 렌더링, 시설물 클릭 상세 조회, 시설물 검색 기능 활성화

### 1-2. 보안 강화 (운영 배포 전 필수)
- **관리자 비밀번호 변경**: 현재 seed 기본값 `admin1234` → 강력한 비밀번호로 교체
- **JWT Secret 교체**: `.env`의 `GIS_JWT_SECRET` → `openssl rand -hex 32`로 생성한 랜덤 값
- **비밀번호 변경 UI 구현**: 현재 DB 직접 수정만 가능 → `/api/v1/auth/change-password` 엔드포인트 + 프론트엔드 UI
- **CSP 헤더 추가**: nginx-spa.conf에 `Content-Security-Policy` 헤더 설정 (XSS 방어 강화)
- **Rate Limiting**: FastAPI 미들웨어로 API 호출 빈도 제한 (로그인 시도 제한 등)

### 1-3. DNS/SSL 외부 접근 활성화
- **Cloudflare DNS A 레코드 등록**: `gis.giraffe.ai.kr` → 서버 IP
- **Let's Encrypt SSL 인증서 발급**: NPM에서 자동 시도 (DNS 등록 후)
- **HTTPS 접속 검증**: 브라우저에서 `https://gis.giraffe.ai.kr/` 접근

### 1-4. gisdb 백업 파이프라인
- **현재**: gisdb 정기 백업 미구축
- **작업**: 기존 maindb 백업 스크립트에 `pg_dump gisdb` 추가
- **권장**: 일 1회 자동 백업 + MinIO 또는 외부 스토리지 전송

---

## 2. 중기 개선 (1~2개월)

### 2-1. 데이터 수집 파이프라인 안정화

#### gis-worker DLQ (Dead Letter Queue)
- **현재**: Kafka consumer 처리 실패 시 로그만 남기고 메시지 소실
- **개선**: 실패 메시지를 `gis.import.dlq` 토픽으로 전송 → 관리자 UI에서 재처리 가능
- **구현**: `worker/main.py`에 DLQ producer 추가, `imports.py` router에 DLQ 재처리 엔드포인트

#### 업로드 진행률 WebSocket
- **현재**: 파일 업로드 후 상태 확인은 수동 폴링 (`GET /api/v1/import/status/{id}`)
- **개선**: gis-worker → Redis Pub/Sub → gis-api WebSocket → 프론트엔드 실시간 진행률
- **UX**: 업로드 → "SHP 파싱 중..." → "DB 임포트 중..." → "변환 중..." → "완료 (12,345건)"

#### CSV 포맷 지원
- **현재**: SHP, GeoJSON, ZIP, GPKG만 지원
- **개선**: CSV 파일의 좌표 컬럼(lat/lng 또는 x/y) 자동 감지 → `ST_MakePoint()`로 Geometry 생성
- **수정**: `gis-worker/worker/ingest.py`에 CSV 핸들러 추가

### 2-2. 검색 기능 고도화

#### 자동완성 하이라이트
- **현재**: 자동완성 결과에 매칭 텍스트 구분 없음
- **개선**: Elasticsearch `highlight` API 활용 → 매칭 텍스트에 `<mark>` 태그 적용
- **수정**: `search.py` autocomplete 함수에 highlight 옵션 추가, 프론트엔드 SearchBar에 `dangerouslySetInnerHTML` 또는 파싱 로직

#### 검색 히스토리
- **현재**: 검색 기록 미저장
- **개선**: localStorage에 최근 검색어 10개 저장, 검색바 포커스 시 히스토리 드롭다운 표시
- **수정**: `SearchBar.tsx`에 localStorage 연동 로직

#### 복합 검색 (시설물 + 주소)
- **현재**: 주소 검색과 시설물 조회가 별도 UI
- **개선**: 단일 검색바에서 주소/시설물 통합 검색 → 결과에 타입(지번/건물/맨홀/관로) 배지 표시
- **수정**: ES 인덱스에 시설물 데이터 추가 인덱싱, `search.py`에 multi-index 검색

### 2-3. 모니터링 대시보드

#### Grafana + Prometheus 연동
- **현재**: `gis-status.sh` CLI 스크립트만 존재
- **개선 항목**:
  - nginx access log → Prometheus exporter → 요청 메트릭 (RPS, 응답시간, 에러율)
  - pg_tileserv 응답시간 모니터링
  - gis-api 엔드포인트별 latency/에러율
  - PostgreSQL 커넥션 수/쿼리 성능
  - Elasticsearch 인덱싱 성능/검색 latency
  - gis-worker Kafka consumer lag
- **serengeti-iac 활용**: 기존 Grafana/Prometheus 인프라가 있으면 대시보드만 추가

#### 알림 설정
- **서비스 다운 알림**: 컨테이너 unhealthy 감지 → Slack/이메일 알림
- **디스크 용량 알림**: 타일 캐시/DB 볼륨 사용률 임계치 초과 시

### 2-4. gis-worker Kafka Consumer Liveness 강화
- **현재**: `pgrep` 기반 프로세스 존재 확인만 수행 (Loop 16)
- **개선**: worker 내부에 경량 HTTP healthcheck 서버 (별도 스레드) 추가
  - `/health` → Kafka consumer 마지막 poll 시간, 처리 중인 작업 수 반환
  - Docker healthcheck을 HTTP 방식으로 교체

---

## 3. 장기 개선 (3~6개월)

### 3-1. 3D 시각화 (deck.gl)
- **현재**: MapLibre GL JS 2D 렌더링만 구현 (Loop 9에서 deck.gl은 Phase 4로 연기)
- **전제**: 3D 좌표 데이터(맨홀 심도, 관로 매설 깊이 등) 확보 필요
- **구현 방향**:
  - `deck.gl` 라이브러리 추가 (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`)
  - `ScatterplotLayer` → 맨홀 3D 심도 시각화
  - `PathLayer` → 관로 3D 경로 시각화
  - `ColumnLayer` → 건물 높이 시각화
- **코드 스플리팅**: deck.gl은 ~500KB이므로 `React.lazy()`로 별도 청크 분리

### 3-2. Neo4j 관로 네트워크 분석
- **현재**: Loop 4에서 장기 과제로 분류. PostGIS만으로 충분한 단계
- **활용 시점**: 관로 흐름 분석, 경로 탐색, 역류 영향 분석 등이 필요해질 때
- **구현 방향**:
  - 하수관로를 Neo4j 그래프(맨홀=Node, 관로=Edge)로 모델링
  - Cypher 쿼리로 최단 경로, 상류/하류 추적, 영향 반경 분석
  - gis-api에 `/api/v1/network/trace?from=MH001&direction=downstream` 엔드포인트
  - serengeti-iac의 Neo4j 5 인스턴스 활용

### 3-3. 실시간 IoT 센서 연동
- **설계 문서 참조**: `04_tobe_architecture_design.md` 장기 개선 #12
- **구현 방향**:
  - Kafka 스트림으로 IoT 센서 데이터(수위, 유량, 수질) 수신
  - gis-api WebSocket으로 프론트엔드에 실시간 push
  - MapLibre에 실시간 마커/히트맵 오버레이
  - Elasticsearch에 시계열 인덱싱 → 이력 조회

### 3-4. COG 래스터 서빙
- **현재**: 정사영상을 SQLite 타일 DB에서 서빙 (레거시 방식)
- **개선**: Cloud Optimized GeoTIFF (COG) 변환 → MinIO에서 HTTP Range Request 서빙
- **장점**: 사전 타일링 불필요, 동적 줌 레벨 지원, 대용량 영상도 효율적 서빙
- **도구**: `gdal_translate -of COG input.tif output_cog.tif`

### 3-5. PMTiles 오프라인 지원
- **설계 문서 참조**: `04_tobe_architecture_design.md` 장기 개선 #13
- **구현 방향**:
  - 대용량 레이어를 PMTiles 포맷으로 사전 빌드 (`tippecanoe --output-to-pmtiles`)
  - MinIO에 저장 → HTTP Range Request로 서빙
  - MapLibre GL JS의 `pmtiles` 프로토콜 핸들러 연동
  - 오프라인 환경(현장 조사 등)에서도 지도 조회 가능

### 3-6. 멀티 테넌시
- **설계 문서 참조**: `04_tobe_architecture_design.md` 장기 개선 #14
- **현재**: `gis.regions` 테이블의 `region_code`로 데이터 격리 (논리적 분리)
- **개선**: 지자체별 독립 환경 제공
  - DB 레벨: 스키마 분리 또는 Row-Level Security (RLS)
  - API 레벨: 테넌트별 API 키 + 접근 범위 제한
  - UI 레벨: 테넌트별 브랜딩 (로고, 색상, 도메인)

---

## 4. 성능 최적화

### 4-1. 벡터 타일 캐싱 고도화
- **현재**: nginx proxy_cache (1GB, 1h inactive) - Loop 11에서 구현
- **개선**:
  - pg_tileserv에 `Cache-Control` 헤더 설정 (upstream 캐시 힌트)
  - Redis L1 캐시 추가 (TTL 1h, 자주 요청되는 타일 z14~16)
  - PMTiles L2 캐시 (MinIO, 사전 빌드된 정적 타일)

### 4-2. PostgreSQL 공간 인덱스 튜닝
- **현재**: GIST 인덱스 13개 (Loop 5 initdb)
- **추가 최적화**:
  - BRIN 인덱스: 대용량 시계열 시설물 데이터에 적합 (디스크 공간 절약)
  - 부분 인덱스: 특정 지역 자주 조회 시 `WHERE region_id = X` 조건부 인덱스
  - `CLUSTER` 명령: 공간적으로 인접한 데이터를 물리적으로 모아 I/O 최적화
  - `VACUUM ANALYZE` 정기 실행 (cron)

### 4-3. 프론트엔드 번들 최적화
- **현재**: maplibre ~1MB, app ~199KB, vendor ~12KB (Loop 14 기준)
- **추가 최적화**:
  - `npx vite-bundle-visualizer`로 상세 분석
  - SearchResults, FacilityDetail 등 조건부 컴포넌트 `React.lazy()` 추가
  - Tree shaking 확인 (미사용 MapLibre 모듈 제거)
  - `@maplibre/maplibre-gl-style-spec` 별도 청크 분리 검토

### 4-4. API 응답 최적화
- **현재**: 전체 GeoJSON geometry 반환
- **개선**:
  - 목록 API에서 geometry 필드 제외 옵션 (`?include_geom=false`)
  - simplified geometry 반환 (`ST_Simplify()` 줌 레벨 기반)
  - 페이지네이션 커서 기반으로 변경 (대량 데이터 offset 성능 문제 방지)

---

## 5. 개발 인프라 / DX

### 5-1. CI/CD 강화
- **현재**: GitHub Actions 8개 job (Loop 12, 20)
- **추가**:
  - Playwright E2E 테스트가 Docker 서비스 의존 → CI에서 안정적 실행 확인 필요
  - 코드 커버리지 리포트 (pytest-cov, istanbul)
  - 자동 릴리스 태깅 (semantic versioning)
  - Docker 이미지 레지스트리 푸시 (GitHub Container Registry)

### 5-2. 로컬 개발 환경 개선
- **현재**: Docker Compose 전체 스택 기동 필요
- **개선**:
  - `docker-compose.dev.yml` 오버라이드 (핫 리로드, 디버그 포트 노출)
  - gis-api: `uvicorn --reload` 모드
  - gis-web: `npm run dev` (Vite HMR)
  - VS Code devcontainer 설정 (.devcontainer/devcontainer.json)

### 5-3. API 문서 자동화
- **현재**: FastAPI Swagger UI 자동 생성 (`/api/docs`)
- **추가**:
  - OpenAPI spec 기반 클라이언트 SDK 자동 생성 (`openapi-typescript-codegen`)
  - API 변경 시 프론트엔드 타입 자동 동기화
  - Postman/Insomnia 컬렉션 자동 export

### 5-4. package-lock.json 생성
- **현재**: Loop 13에서 미생성 확인
- **작업**: `cd gis-web && npm install` → `package-lock.json` 커밋
- **목적**: 재현 가능한 빌드 보장, CI에서 `npm ci` 사용 가능

---

## 6. AS-IS → TO-BE 잔여 매핑

> `04_tobe_architecture_design.md`에서 설계했으나 아직 미구현된 항목

| 설계 항목 | 설계 문서 위치 | 구현 상태 | 비고 |
|-----------|---------------|----------|------|
| PostGIS 이미지 교체 | 2.2 서비스 매핑 | 완료 | Loop 14 |
| gis/auth/audit 스키마 | 3.1 DB 스키마 | 완료 | Loop 5 |
| pg_tileserv / pg_featureserv | 2.2 서비스 매핑 | 완료 | Loop 5 |
| FastAPI 백엔드 (gis-api) | 5. REST API 설계 | 완료 | Loop 7 |
| Kafka 수집 파이프라인 (gis-worker) | 7. 데이터 수집 파이프라인 | 완료 | Loop 8 |
| React + MapLibre 프론트엔드 | 8. 프론트엔드 아키텍처 | 완료 | Loop 9 |
| ES nori 주소 검색 | 4. 검색 인덱스 | 완료 | Loop 18 |
| Redis 캐싱 + graceful fallback | 9.1 캐싱 레이어 | 완료 | Loop 7, 16 |
| JWT 인증 + 역할 기반 접근제어 | 10. 보안 | 완료 | Loop 7 |
| nginx 타일 캐시 | 9.1 캐싱 레이어 | 완료 | Loop 11 |
| **deck.gl 3D 시각화** | 8. 프론트엔드 | **미구현** | 3D 데이터 확보 필요 |
| **Neo4j 관로 분석** | 장기 개선 #11 | **미구현** | 장기 과제 |
| **IoT 센서 연동** | 장기 개선 #12 | **미구현** | 센서 인프라 필요 |
| **COG 래스터 서빙** | 장기 개선 #10 | **미구현** | 정사영상 COG 변환 필요 |
| **PMTiles 오프라인** | 장기 개선 #13 | **미구현** | 오프라인 요구 시 |
| **멀티 테넌시** | 장기 개선 #14 | **미구현** | 복수 지자체 운영 시 |
| **CORS 화이트리스트** | 10. 보안 | **부분** | FastAPI 설정 필요 |
| **CSP 헤더** | 10. 보안 | **미구현** | nginx 설정 추가 |
| **Rate Limiting** | 10. 보안 | **미구현** | FastAPI 미들웨어 |
| **BRIN/부분 인덱스** | 9.2 인덱스 튜닝 | **미구현** | 데이터량 증가 시 |
| **gis-worker DLQ** | 7. 수집 파이프라인 | **미구현** | 안정성 강화 |

---

## 7. 우선순위 요약

```
즉시 (이번 주)
├── Cloudflare DNS A 레코드 등록 + SSL 인증서
├── 관리자 비밀번호 / JWT Secret 변경
├── 서비스 재빌드 (make gis) - Loop 16~20 변경 반영
└── gisdb 백업 파이프라인 구축

단기 (1~2주)
├── 시설물 데이터 확보 방안 결정 + 마이그레이션
├── 비밀번호 변경 UI 구현
├── CSP 헤더 + Rate Limiting 추가
└── package-lock.json 생성

중기 (1~2개월)
├── gis-worker DLQ + 업로드 진행률 WebSocket
├── 검색 하이라이트 + 히스토리 + 복합 검색
├── Grafana + Prometheus 모니터링 대시보드
├── gis-worker Kafka liveness HTTP healthcheck
└── 로컬 개발 환경 개선 (devcontainer, hot reload)

장기 (3~6개월)
├── deck.gl 3D 시각화 (3D 데이터 확보 후)
├── Neo4j 관로 네트워크 분석
├── 실시간 IoT 센서 연동
├── COG 래스터 + PMTiles 오프라인 지원
└── 멀티 테넌시
```

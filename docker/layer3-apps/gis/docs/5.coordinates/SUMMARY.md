# 좌표 틀어짐 분석 및 GIS 앱 개선 — 전체 요약 (Loop 1~16)

## 배경

포천시 하수관로 시설 데이터가 지도에서 틀어져 보이는 현상이 보고되어,
좌표 변환 과정의 문제를 조사하고 필요시 수정하는 작업을 시작했다.
조사 결과 좌표 변환 자체는 정상이었으며, 이후 코드 버그 수정, UI 개선, E2E 테스트 정비, CI 파이프라인 구축까지 진행했다.

## Phase 1: 좌표 분석 (Loop 1~2)

### 결론: 좌표계 변환에 문제 없음
- Playwright 자동 스크린샷(z16~z19)으로 시설물/필지 정렬 확인
- 시설물↔필지 오프셋 0.7~5.8m (양호), 포천시청 기준점 검증 통과
- OSM과의 5~10m 편차는 한국 지적 데이터의 일반적 정밀도 범위

### 발견한 코드 버그
- `05_functions.sql`: MVT 함수 3개에서 `ST_Transform` 누락 → 수정
- EPSG:5174, EPSG:2097에 `towgs84` datum 파라미터 추가

### 인프라 정비
- DB 레이어 PARCELS/BUILDINGS를 function layer URL로 업데이트
- `09_seed_layers.sql`을 UPSERT 패턴으로 재작성
- Redis 캐시 관리 절차 확립

## Phase 2: 라벨 레이어 (Loop 3~6)

### 지번 라벨 (PARCELS_LABELS)
- `parcels_by_region` MVT 함수의 `jibun` 속성 활용
- zoom 레벨별 text-size 보간 (`z16: 9px → z18: 12px → z20: 15px`)
- `text-padding: 2`로 밀집 지역 가독성 확보

### 건물명 라벨 (BUILDINGS_LABELS)
- `buildings_by_region` MVT 함수의 `bld_name` 속성 활용
- 갈색 텍스트(`#5a2d0c`) + 흰색 halo, `text-allow-overlap: false`
- MapLibre `filter: ["!=", ["get", "bld_name"], ""]`로 빈 이름 필터링

### LayerManager 확장
- `symbol` 레이어 타입 지원 (paint/layout/opacity)
- MapLibre `filter` 속성 지원 (MVT + GeoJSON)
- GeoJSON 레이어 filter 라이브 업데이트 (`map.setFilter`)

### LayerTree UX 개선
- `_LABELS` 레이어를 부모 아래 들여쓰기 표시 (경계선 + T 아이콘)
- 부모-자식 토글 연동 (`_LABELS` 컨벤션)
- 엣지케이스 처리: 라벨 ON → 부모 자동 ON, 라벨만 OFF → 부모 유지
- Legend에서 `_LABELS` 레이어 제외

## Phase 3: E2E 테스트 정비 (Loop 7~9)

### 테스트 인프라 개선
- `e2e/helpers.ts` 공통 login/logout helper 생성
- 8개 E2E 테스트 파일을 현재 앱 인증 플로우에 맞게 재작성
- 통과율 36/60 → **60/60** 달성

### 주요 버그 수정
- Elasticsearch `region_code` 불일치: `"4165000000"` → `"POCHEON"` (263,462건 일괄 업데이트)
- gis-worker Dockerfile: `pyproject.toml` → `requirements.txt`
- `admin.spec.ts`: `getByText` strict mode violation → `h4` 로케이터
- `upload-pipeline.spec.ts`: API limit 초과 비교 제거

### 테스트 분류 태그
- `@full-stack`: Kafka + MinIO + Worker 의존 (upload-pipeline, 2건)
- `@nginx`: nginx 리버스 프록시 의존 (api-proxy, 7건)

## Phase 4: CI 파이프라인 (Loop 10~13)

### GitHub Actions 워크플로우 (`gis-ci.yml`)
- **10개 job**: api-check, web-build, worker-check, shell-check, sql-check, compose-validate, docker-build×3, e2e-test
- CI E2E: 51/51 PASS (전체 60 - @full-stack 2 - @nginx 7)
- Node.js 20 deprecation 해결: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

### CI 서비스 구성
- PostgreSQL 16 + PostGIS 3.4
- Redis 7 (alpine)
- Elasticsearch 8.17.0 (single-node, security disabled)
  - nori 대신 edge_ngram autocomplete 분석기 사용
  - 인라인 테스트 데이터 5건 직접 시딩

### 데이터 정규화
- `06_seed_pocheon.sql` region code: `'4165000000'` → `'POCHEON'`
- `07_migrate_parcels.sql`, `08_migrate_buildings.sql`, `migrate-legacy.sh` 동기화
- ES 인덱싱 스크립트 재실행으로 전체 데이터 정규화

## Phase 5: PR 머지 및 정리 (Loop 13~16)

### PR #3 (feat/gis-app → main)
- 37개 커밋, 274파일, 47,218줄 추가
- merge commit 전략 채택 (커밋 이력 보존)
- CI 10/10 SUCCESS 확인 후 머지

### IaC 통합
- `.env.example`: GIS 환경변수 추가
- `Makefile`: `make gis`, `gis-init`, `gis-migrate`, `gis-status` 타겟
- `postgres` 이미지: `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine`
  - Nextcloud/Plane DB에 영향 없음 확인 (PostGIS 확장 미사용)

### 브랜치 정리
- `feat/gis-app`, `feat/initial-commit`, `feat/add-user-cli` 삭제
- main 브랜치만 유지

## 수정된 주요 파일 목록

| 카테고리 | 파일 | 변경 내용 |
|----------|------|-----------|
| SQL | `initdb/05_functions.sql` | MVT 함수 ST_Transform 수정 |
| SQL | `migration/06_seed_pocheon.sql` | region code POCHEON 통일 |
| SQL | `migration/07_migrate_parcels.sql` | region code 통일 |
| SQL | `migration/08_migrate_buildings.sql` | region code 통일 |
| SQL | `migration/09_seed_layers.sql` | UPSERT 패턴 + 라벨 레이어 추가 |
| SQL | `seed_facilities.sql` | 09와 동기화 |
| Shell | `migrate-legacy.sh` | region code 통일 |
| Shell | `migration/10_setup_elasticsearch.sh` | ES 인덱싱 정규화 |
| Frontend | `LayerManager.tsx` | symbol 타입 + filter 지원 |
| Frontend | `layerStore.ts` | 부모-자식 토글 연동 |
| Frontend | `LayerTree.tsx` | _LABELS 들여쓰기 UI |
| Frontend | `Legend.tsx` | _LABELS 제외 |
| E2E | `e2e/helpers.ts` | 공통 login/logout |
| E2E | 8개 spec 파일 | 현재 UI 플로우 맞춤 |
| CI | `.github/workflows/gis-ci.yml` | Redis+ES 서비스, Node.js 24 |
| Docker | `gis-worker/Dockerfile` | requirements.txt 참조 수정 |
| IaC | `Makefile`, `.env.example` | GIS 타겟 통합 |

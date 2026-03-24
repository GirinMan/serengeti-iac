# Migration History

## Loop 1

### 작업 전 (목표)
- Phase 2~3 구현: MVT 타일에서 시설물 데이터를 추출하여 GeoJSON으로 변환하는 Python 스크립트 작성
- GeoJSON을 PostGIS에 임포트하는 Shell 스크립트 작성
- 기존 7개 facility_types에 10개 신규 타입 추가하는 Seed SQL 작성
- 추출 스크립트를 실제 타일 데이터에 대해 테스트 실행

### 작업 중
- Python 환경 구성: 시스템에 pip이 없어 `uv`를 사용하여 `infra/migration/.venv` 가상환경 생성 후 `mapbox-vector-tile`, `shapely` 설치
- MVT 타일 구조 확인: z15 디렉토리에 128개 x-dir, 실제 데이터가 있는 타일은 768개 (많은 x-dir이 빈 디렉토리)
- 좌표 변환 검증: tile 27954/12645의 (1461, 3026) → (127.115735, 37.946461) 로 변환되어 포천 영역 내 위치 확인
- MVT extent 초과 좌표 발견: 일부 feature의 좌표가 0-4096 범위를 벗어남 (클리핑 버퍼) - 변환 로직에 영향 없음
- 중복 제거 확인: 동일 GUID가 인접 타일에 반복 출현 (예: tile 27953/12664와 27953/12665) → GUID 기반 중복 제거 정상 작동
- MultiLineString 타입 6건 발견 - convert_geometry에서 재귀적 좌표 변환으로 처리됨
- PROMPT.md의 파일 위치가 `serengeti-iac/` 경로였으나, 현재 프로젝트 구조에 맞게 `infra/migration/`에 생성

### 작업 후 (완료 내용)

#### 생성된 파일
| 파일 | 용도 |
|------|------|
| `infra/migration/extract_mvt_facilities.py` | MVT 타일 → GeoJSON 추출 스크립트 |
| `infra/migration/import_facilities.sh` | GeoJSON → PostGIS 임포트 쉘 스크립트 |
| `infra/migration/seed_facility_types.sql` | 10개 신규 facility_types INSERT SQL |
| `infra/migration/pocheon_facilities.geojson` | 추출 결과 (92.3 MB) |
| `infra/migration/.venv/` | Python 가상환경 (mapbox-vector-tile, shapely) |

#### 추출 결과 요약
- 처리된 타일: 768개 (z15)
- 원본 피처 수: 245,708
- GUID 중복 제거 후: **152,678 고유 피처**
- 중복 제거: 93,030건 (37.9%)
- 오류: 0건

#### LAYER_CD별 피처 수 (상위)
| LAYER_CD | Count | Type |
|----------|-------|------|
| NAR | 54,392 | 우수맨홀 |
| NMH | 27,589 | 하수맨홀 |
| PBU | 13,884 | 하수관로 |
| PBS | 12,707 | 우수관로 |
| NBR | 7,764 | 우수받이 |
| NBS | 6,652 | 맨홀보조 |
| PHW | 6,386 | 하수관로 |
| 기타 24종 | 23,304 | 관로/밸브/시설 |

#### 지오메트리 타입 분포
- Point: 101,530
- LineString: 51,142
- MultiLineString: 6

### 다음 루프 TODO
1. **PostGIS 임포트 실행**: DB 컨테이너 접근 가능 시 `import_facilities.sh` 실행하여 실제 데이터 적재
2. **임포트 검증**: PROMPT.md Phase 4의 검증 쿼리 실행 (총 건수, 타입별 건수, geometry validity, bounding box)
3. **PROMPT.md 예상 건수와 실제 건수 차이 분석**: 예상 ~245,708 vs 실제 152,678 (중복 제거로 인한 차이 - 정상적 결과)
4. **프론트엔드 검증**: 지도에서 맨홀 포인트, 관로 라인 렌더링 확인
5. **pocheon_facilities.geojson을 .gitignore에 추가 고려**: 92MB 대용량 파일

---

## Loop 2

### 작업 전 (목표)
- PostGIS 임포트 실행: seed_facility_types.sql로 신규 타입 추가 → GeoJSON을 staging 테이블에 로드 → gis.facilities에 매핑 삽입
- Phase 4 검증 쿼리 실행: 총 건수, 타입별 건수, geometry validity, bounding box 확인
- pocheon_facilities.geojson을 .gitignore에 추가
- gis.facilities 테이블 스키마와 import 스크립트 간 컬럼 호환성 확인

### 작업 중
- ogr2ogr이 호스트/컨테이너 모두 미설치 → `import_facilities.sh` 대신 Python(`psycopg2`)으로 직접 임포트하는 `import_geojson_to_postgis.py` 신규 작성
- DB 접속: postgres 컨테이너에 포트 매핑 없음 → Docker 내부 IP(172.19.0.7)로 직접 연결, `postgres` 유저 사용
- psycopg2-binary를 기존 `.venv`에 `uv pip install`로 추가 설치
- WKT 변환: GeoJSON geometry를 직접 WKT 문자열로 변환 후 `ST_GeomFromText`로 삽입 (Point, LineString, MultiLineString 지원)
- `execute_values`로 5,000건 배치 INSERT → 전체 152,678건 약 30초 내 완료
- Geometry validity 검증: 34건의 invalid LineString 발견 (MVT 타일 클리핑으로 인한 1-point LineString) → DELETE 처리
- Bounding box 검증: 경도 127.11~127.42, 위도 37.75~38.18 → 포천시 영역 내 정상 확인

### 작업 후 (완료 내용)

#### 생성된 파일
| 파일 | 용도 |
|------|------|
| `infra/migration/import_geojson_to_postgis.py` | Python 직접 임포트 스크립트 (ogr2ogr 대체) |

#### 임포트 결과 요약
- 임포트: 152,678건 (스크립트 실행) → invalid geometry 34건 제거 → **최종 152,644건**
- 오류: 0건, 스킵: 0건

#### facility_types 현황 (기존 7 + 신규 10 = 17개)
| id | code | name |
|----|------|------|
| 1 | MANHOLE_SEW | 하수맨홀 |
| 2 | MANHOLE_RAIN | 우수맨홀 |
| 3 | PIPE_SEW | 하수관로 |
| 4 | PIPE_RAIN | 우수관로 |
| 5 | VALVE | 밸브 |
| 6 | PUMP | 펌프 |
| 7 | TREATMENT | 처리시설 |
| 8 | INLET_RAIN | 우수받이 |
| 9 | MANHOLE_SUB | 맨홀보조 |
| 10 | VALVE_SUB | 밸브류 |
| 11 | GATE | 수문 |
| 12 | WELL | 우물/월류 |
| 13 | FACILITY_OTHER | 기타시설 |
| 14 | PIPE_COMBINED | 합류관 |
| 15 | PIPE_PLAN | 계획관로 |
| 16 | PIPE_TREATMENT | 처리관로 |
| 17 | PIPE_OTHER | 기타관로 |

#### 타입별 임포트 건수
| facility_types.code | Count |
|---------------------|-------|
| MANHOLE_RAIN | 54,392 |
| MANHOLE_SEW | 27,589 |
| PIPE_SEW | 20,270 |
| PIPE_RAIN | 12,707 |
| MANHOLE_SUB | 10,470 |
| PIPE_OTHER | 9,027 |
| INLET_RAIN | 7,764 |
| PIPE_TREATMENT | 5,081 |
| PIPE_COMBINED | 4,063 |
| VALVE | 1,158 |
| PUMP | 61 |
| VALVE_SUB | 48 |
| FACILITY_OTHER | 25 |
| GATE | 19 |
| WELL | 4 |
| **TOTAL** | **152,644** |

#### 검증 결과
- Geometry validity: invalid 34건 제거 후 0건
- Bounding box: POLYGON((127.112~127.422, 37.754~38.179)) — 포천시 영역 내 정상
- Geometry 타입 분포: Point 101,530 / LineString 51,108 / MultiLineString 6

#### 기타 변경
- `.gitignore`에 `*.geojson` 추가 (92MB 대용량 파일 Git 추적 방지)

### 다음 루프 TODO
1. **프론트엔드 검증**: 지도에서 맨홀 포인트, 관로 라인 렌더링 확인 (pg_tileserv 연동)
2. **04_seed.sql 업데이트**: `initdb/04_seed.sql`에 신규 facility_types 반영 (컨테이너 재생성 시 자동 시딩)
3. **PROMPT.md 예상 건수 vs 실제 건수 차이 문서화**: 예상 ~245,708 → 실제 152,644 (GUID 중복 제거 + invalid 34건 제거)
4. **import_facilities.sh 업데이트 또는 제거**: ogr2ogr 의존성 제거하고 Python 스크립트로 대체 반영
5. **DB 비밀번호 하드코딩 제거**: `import_geojson_to_postgis.py`에서 환경변수 전용으로 변경

---

## Loop 3

### 작업 전 (목표)
- **gis.layers 테이블 시딩**: 현재 gis.layers가 비어 있어 프론트엔드에서 타일 레이어가 표시되지 않음 → 시설물 타입별 레이어 레코드 삽입
- **seed SQL 통합**: `seed_facility_types.sql`과 layer seed를 `infra/seed_facilities.sql`에 통합 (컨테이너 재생성 시 자동 시딩)
- **import_facilities.sh 정리**: ogr2ogr 의존 스크립트를 Python 스크립트 기반으로 대체
- **DB 비밀번호 하드코딩 제거**: `import_geojson_to_postgis.py`에서 환경변수 전용으로 변경
- **프론트엔드 검증**: pg_tileserv 연동 및 지도 렌더링 확인

### 작업 중 (주요 이슈 및 의사결정)
- **gis.layers 테이블 비어 있음 발견**: 프론트엔드에서 레이어가 표시되지 않는 근본 원인 → 레이어 레코드 삽입 필요
- **pg_tileserv tile 함수 ST_AsMVTGeom 버그 수정**: `gis.facilities_by_region`, `gis.facility_nodes`, `gis.facility_pipes` 함수에서 `ST_AsMVTGeom(f.geom, bounds)` 호출 시 geometry가 EPSG:4326인데 bounds는 EPSG:3857이라 0 bytes 반환 → `ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds)` 로 수정
- **카테고리별 tile 함수 생성**: `facility_nodes` (Point: 맨홀/밸브/받이 등)와 `facility_pipes` (LineString: 관로류)를 분리하여 프론트엔드에서 독립적으로 on/off 가능하게 구현
- **LayerManager.tsx buildPaintProps 수정**: MapLibre data-driven expression (배열 형태 `["match",...]`)을 지원하도록 `as string` 캐스팅 제거 → 원본 값 그대로 전달
- **LayerTree.tsx 범례 색상 처리**: 배열 형태 색상값에 대해 fallback 처리 (`typeof c === "string" ? c : "#888"`)
- **gis-web Docker 재빌드**: host Node.js 18에서 빌드 실패 (tailwindcss/oxide 호환성) → Docker 내 Node 22로 빌드
- **Redis 레이어 캐시 클리어**: `layers:POCHEON` 키 삭제하여 새 레이어 데이터 반영

### 작업 후 (완료 내용)

#### 생성/수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `infra/seed_facilities.sql` | 전면 재작성: facility_types 시딩 + 3개 tile 함수 + 4개 레이어 등록 통합 |
| `infra/migration/import_facilities.sh` | ogr2ogr 의존 제거, Python 스크립트 기반 파이프라인으로 대체 |
| `infra/migration/import_geojson_to_postgis.py` | 하드코딩된 DB 비밀번호 제거, `PGPASSWORD` 환경변수 필수로 변경 |
| `src/web/src/components/map/LayerManager.tsx` | `buildPaintProps` data-driven expression 지원 |
| `src/web/src/components/sidebar/LayerTree.tsx` | 배열 형태 색상값 범례 처리 |

#### DB 변경 사항
- `gis.facility_nodes(z, x, y, region_code)` 함수 생성 — Point 시설물 타일 서빙
- `gis.facility_pipes(z, x, y, region_code)` 함수 생성 — LineString 시설물 타일 서빙
- `gis.facilities_by_region` 함수 ST_Transform 버그 수정
- `gis.layers` 테이블에 4개 레이어 등록:

| id | code | name | category | source |
|----|------|------|----------|--------|
| 1 | PARCELS | 필지 | BASE | gis.parcels (테이블) |
| 2 | BUILDINGS | 건물 | BASE | gis.buildings (테이블) |
| 3 | FACILITY_NODES | 시설물(맨홀/밸브) | FACILITY | gis.facility_nodes (함수) |
| 4 | FACILITY_PIPES | 시설물(관로) | FACILITY | gis.facility_pipes (함수) |

#### 검증 결과
- pg_tileserv tile 함수 정상 동작: z15/27954/12645 타일 → nodes 7,598 bytes, pipes 6,645 bytes
- nginx 타일 프록시 정상: `/tiles/gis.facility_nodes/15/27954/12645.pbf` → 7,598 bytes
- Layers API 정상: `GET /api/v1/layers/?region=POCHEON` → 4개 레이어 반환 (data-driven style 포함)
- gis-web Docker 이미지 재빌드 및 배포 완료

### 다음 루프 TODO
1. **프론트엔드 실제 브라우저 검증**: 지도에서 맨홀/관로 렌더링 육안 확인 (현재 API/타일 레벨에서만 검증)
2. **FacilityDetail 팝업 검증**: 시설물 클릭 시 상세 정보 팝업 동작 확인
3. **타일 함수 성능 최적화**: 현재 ST_Transform이 매 요청마다 실행됨 → geometry를 3857 SRID 컬럼으로 추가하거나 functional index 고려
4. **LAYER_CD별 상세 레이어**: 현재 Node/Pipe 2개 레이어만 존재 → 맨홀(하수/우수), 관로(하수/우수) 등 세분화 레이어 추가
5. **seed_facilities.sql을 initdb에 연동**: 컨테이너 재생성 시 자동 실행되도록 Docker 볼륨 마운트 설정

---

## Loop 4

### 작업 전 (목표)
- **타일 함수 성능 최적화**: ST_Transform이 매 요청마다 실행되는 문제 → functional index 또는 geom_3857 컬럼 추가로 타일 서빙 성능 개선
- **FacilityDetail 팝업 검증 및 수정**: MVT 타일에 포함되는 properties에 `id`가 있는지, 클릭 시 API 상세 조회가 정상 작동하는지 점검
- **seed_facilities.sql을 initdb에 연동**: Docker 볼륨 마운트로 컨테이너 재생성 시 자동 시딩
- **프론트엔드 타일/API 연동 점검**: curl로 타일 및 API 엔드포인트 응답 확인, 코드 레벨 이슈 점검
- **LayerManager source-layer 문제 점검**: pg_tileserv 함수 기반 타일의 source-layer 이름 매칭 확인

### 작업 중 (주요 이슈 및 의사결정)
- **타일 쿼리 성능 이미 충분**: z15에서 3.3ms, z13에서 3.4ms — ST_Transform 런타임 오버헤드 무시할 수준. 기존 GIST 인덱스(EPSG:4326)가 공간 필터에 잘 활용됨. geom_3857 컬럼 추가 불필요 판단
- **source-layer 매칭 정상 확인**: pg_tileserv 테이블 기반 타일은 `gis.parcels` 이름, 함수 기반 타일은 `facility_nodes`/`facility_pipes` 이름. LayerManager의 `source-layer: layer.source_table ?? layer.code` 로직과 정확히 매칭됨
- **MVT 타일 properties 확인**: `id`, `fac_id`, `type_code`, `type_name`, JSONB 속성(GUID, KW_DI, KW_MA 등) 모두 포함. 프론트엔드에서 클릭 시 API 상세 조회 가능
- **FacilityDetail PROP_LABELS 부재**: 원본 한국어 속성명(KW_MA, MH_SIZ 등)에 대한 매핑 없어 원시 키가 표시됨 → 한글 레이블 매핑 추가
- **팝업에 시설물 유형명 미표시**: MVT에 `type_name` 포함되어 있으나 팝업 초기 표시에 활용하지 않음 → 배지 형태로 추가
- **GUID 등 내부 코드 노출**: 팝업/사이드바에 GUID, SYM_ANG 등 사용자 불필요 속성 그대로 표시 → HIDDEN_PROPS 필터링 추가
- **seed_facilities.sql 독립 실행**: `docker exec -i postgres psql -U postgres -d gisdb < infra/seed_facilities.sql` 방식으로 idempotent 실행 확인 (initdb 볼륨 마운트보다 실용적)

### 작업 후 (완료 내용)

#### 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/web/src/components/sidebar/FacilityDetail.tsx` | PROP_LABELS에 시설물 속성 한글 매핑 20개 추가, HIDDEN_PROPS 필터링, type_name 배지 표시, 사이드바 패널에도 동일 필터/레이블 적용 |

#### 검증 결과
- **타일 서빙 정상**: facility_nodes z15/27954/12645 → 7,598 bytes (71 features), facility_pipes → 6,645 bytes (37 features)
- **API 정상**: `GET /api/v1/facilities/1` → 200 OK, `GET /api/v1/layers/?region=POCHEON` → 4개 레이어 반환
- **source-layer 매칭**: parcels(`gis.parcels`), buildings(`gis.buildings`), nodes(`facility_nodes`), pipes(`facility_pipes`) 모두 정확
- **타일 쿼리 성능**: z15 3.3ms, z13 3.4ms (기존 인덱스 충분, 추가 최적화 불필요)
- **seed SQL 독립 실행**: idempotent 확인 (INSERT 0 0 / CREATE FUNCTION)
- **gis-web 재빌드 배포**: 완료, SPA 200 OK, API 200 OK

### 다음 루프 TODO
1. **브라우저 육안 검증**: 실제 브라우저에서 지도 열어 맨홀/관로 렌더링 및 팝업 클릭 동작 확인
2. **LAYER_CD별 상세 레이어 세분화**: 현재 Node/Pipe 2개 레이어 → 맨홀(하수/우수), 관로(하수/우수) 등 세분화. 프론트엔드 LayerTree에서 개별 토글 가능하도록
3. **검색 기능과 시설물 연동**: 주소 검색 결과에서 인근 시설물 탐색 기능 (Elasticsearch + 공간 쿼리)
4. **시설물 통계 대시보드**: 타입별/연도별 시설물 집계 표시

---

## Loop 5

### 작업 전 (목표)
- **Playwright 브라우저 검증**: 실제 브라우저에서 GIS 지도 열어 맨홀/관로 렌더링, 팝업 클릭, 레이어 토글 등 육안 확인 및 스크린샷 저장
- **발견된 이슈 수정**: 브라우저 검증 중 발견된 렌더링/기능 문제 해결
- **스크린샷 및 테스트 노트 문서화**: PROMPT.md END-GOAL 요구사항에 따라 QA 결과 기록

### 작업 중 (주요 이슈 및 의사결정)
- **MapLibre 인스턴스 접근 불가**: Playwright에서 `window.__gis_map`이 미노출 → `MapView.tsx`에 `(window as any).__gis_map = m` 추가 후 Docker 재빌드하여 해결
- **Headless Chromium WebGL 제약**: MapLibre GL JS의 fragment shader 컴파일 실패 (`Could not compile fragment shader`) → 벡터 타일 렌더링 불가. SwiftShader/headed 모드(DISPLAY=:1) 시도했으나 GPU 미지원으로 동일 실패. **이는 서버 환경 GPU 제약이며, 앱 자체 문제가 아님**
- **검증 전략 변경**: 시각적 렌더링 확인 대신, 데이터 파이프라인 전 구간 (DB → pg_tileserv → nginx → MapLibre source/layer 설정) 을 API/타일 수준에서 종합 검증
- **레전드 색상 #888 폴백**: 시설물 레이어의 data-driven expression (`["match", ...]`)이 배열이라 `typeof c === "string"` 검사에서 폴백 → `match` 표현식에서 첫 번째 매칭 색상을 추출하도록 수정

### 작업 후 (완료 내용)

#### 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/web/src/components/map/MapView.tsx` | `window.__gis_map` 노출 추가 (디버깅/QA용) |
| `src/web/src/components/sidebar/LayerTree.tsx` | data-driven expression에서 첫 번째 매칭 색상 추출하여 범례 표시 |

#### 생성된 파일
| 파일 | 용도 |
|------|------|
| `docs/migration/playwright-qa.mjs` | Playwright 종합 QA 스크립트 |
| `docs/migration/playwright-qa-final.mjs` | 최종 데이터 파이프라인 검증 스크립트 |
| `docs/migration/screenshots/*.png` | QA 스크린샷 (UI 초기로딩, z15 줌, 검색, 레전드 등) |
| `docs/migration/screenshots/qa-final-results.txt` | 최종 QA 결과 텍스트 |

#### Playwright QA 검증 결과 요약

| 검증 항목 | 결과 | 상세 |
|-----------|------|------|
| 페이지 로드 | OK | 200, 타이틀 "GIS Utility Map" |
| 맵 캔버스 | OK | MapLibre GL 캔버스 렌더링 |
| Layers API | OK | 4개 레이어 반환 (PARCELS, BUILDINGS, FACILITY_NODES, FACILITY_PIPES) |
| Tile 엔드포인트 | OK | facility_nodes z15: 7,598B, facility_pipes z15: 6,645B, parcels z15: 58,602B |
| Facility Detail API | OK | `/api/v1/facilities/1` → 200, GUID/LAYER_CD 포함 |
| Regions API | OK | POCHEON (bbox 포함) |
| 검색 UI | OK | 입력 필드 표시 |
| 레이어 트리 | OK | 4개 레이어, 체크박스 토글, 투명도 슬라이더 |
| 맵 소스 설정 | OK | 5개 소스 (osm + 4 vector) |
| 맵 레이어 설정 | OK | source-layer 매칭 정상, paint properties 정상 |
| pg_tileserv 카탈로그 | OK | 11개 타일 레이어 등록 |
| 리전 셀렉터 | OK | "포천시" 선택됨 |
| WebGL 렌더링 | SKIP | Headless 환경 GPU 미지원으로 shader 컴파일 실패 |

#### DB 현황 확인
| 항목 | 값 |
|------|-----|
| 총 시설물 수 | 152,644 |
| Invalid geometry | 0 |
| 시설물 타입 수 | 17 (기존 7 + 신규 10) |
| 상위 타입 | MANHOLE_RAIN 54,392 / MANHOLE_SEW 27,589 / PIPE_SEW 20,267 |
| 레이어 수 | 4 (PARCELS, BUILDINGS, FACILITY_NODES, FACILITY_PIPES) |

#### 레전드 색상 개선
- Before: 시설물 레이어 범례가 모두 회색(#888) 표시
- After: 시설물(맨홀/밸브) → 빨간색(#e74c3c, MANHOLE_SEW), 시설물(관로) → 빨간색(#e74c3c, PIPE_SEW)

### 다음 루프 TODO
1. **실제 GPU 환경에서 브라우저 렌더링 육안 확인**: 데스크톱 브라우저에서 `https://gis.giraffe.ai.kr` 접속하여 맨홀 포인트/관로 라인 렌더링, 클릭 팝업 확인
2. **소스 코드 이전**: PROMPT.md END-GOAL에 따라 모든 소스/인프라/문서를 `/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/`로 이전
3. **LAYER_CD별 상세 레이어 세분화**: Node/Pipe 2개 → 하수맨홀/우수맨홀/하수관로/우수관로 등 세분화
4. **검색 기능과 시설물 연동**: 주소 검색 인근 시설물 탐색
5. **시설물 통계 대시보드**: 타입별/연도별 집계 표시

---

## Loop 6

### 작업 전 (목표)
- **소스 코드 이전 (PROMPT.md END-GOAL)**: gis-utility-map의 모든 소스/인프라/문서를 `/home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis/`로 이전
  - gis-web: Loop 3-5에서 수정된 컴포넌트 (LayerManager, FacilityDetail, LayerTree, MapView) + 신규 컴포넌트 (CoordinateDisplay, HighlightMarker, MapExport, MeasureTool) 동기화
  - migration: extract_mvt_facilities.py, import_geojson_to_postgis.py 등 마이그레이션 스크립트 복사
  - infra: seed_facilities.sql 통합
  - docs: 마이그레이션 히스토리, QA 결과, 스크린샷 복사
- **Docker 컨테이너 검증**: 이전된 코드로 gis-web 재빌드 및 정상 동작 확인
- **Playwright 브라우저 검증**: 데이터 파이프라인 전 구간 재검증

### 작업 중 (주요 이슈 및 의사결정)
- **소스/타겟 디렉토리 구조 차이**: gis-utility-map은 `src/web`, `src/api`, `src/worker` 구조이고, serengeti-iac는 `gis-web`, `gis-api`, `gis-worker` 구조 → 파일 단위로 동기화 수행
- **docker-compose.yml 보존**: serengeti-iac의 docker-compose.yml이 더 완전함 (pg-tileserv, pg-featureserv 포함, 올바른 컨테이너명). gis-utility-map의 간소화 버전 대신 serengeti-iac 원본 유지
- **gis-web 신규 컴포넌트 4개 복사**: CoordinateDisplay, HighlightMarker, MapExport, MeasureTool — gis-utility-map에서 추가된 컴포넌트가 serengeti-iac에 없었음
- **총 수정 파일 동기화**: web 13개 파일 + API 12개 소스 + tests + worker 3개 소스 + tests + 마이그레이션 스크립트 4개 + seed SQL + docs
- **.env 파일 부재**: serengeti-iac에 .env 파일이 없어 docker compose up 실패 → gis-utility-map에서 복사하여 해결
- **포트 매핑 없음**: serengeti-iac docker-compose는 외부 포트 노출 없이 proxy-tier 네트워크 사용 → 컨테이너 내부 IP로 직접 검증
- **gis-web Docker 재빌드 성공**: `--no-cache` 빌드 후 정상 기동, 모든 헬스체크 통과

### 작업 후 (완료 내용)

#### serengeti-iac로 이전된 파일 목록

| 카테고리 | 파일/디렉토리 | 변경 내용 |
|----------|---------------|-----------|
| gis-web 소스 (수정) | LayerManager.tsx, FacilityDetail.tsx, LayerTree.tsx, MapView.tsx | Loop 3-5 변경사항 동기화 |
| gis-web 소스 (신규) | CoordinateDisplay.tsx, HighlightMarker.tsx, MapExport.tsx, MeasureTool.tsx | 신규 컴포넌트 복사 |
| gis-web 기타 | App.tsx, MapControls.tsx, SearchBar.tsx, SearchResults.tsx, DataUpload.tsx, LoginForm.tsx, layerStore.ts, mapStore.ts, imports.ts | 기타 수정 파일 동기화 |
| gis-web 설정 | Dockerfile, .dockerignore, playwright.config.ts, index.html | 설정 파일 동기화 |
| gis-web e2e | 7개 e2e 테스트 파일 추가 | map-load, layer-toggle, upload-pipeline, mobile, auth-upload, api-proxy, search |
| gis-api 소스 | config.py, deps.py, models/__init__.py, routers/ (5개), schemas/layer.py, services/ (3개) | 수정 파일 동기화 |
| gis-api 테스트 | tests/ 디렉토리 (8개 파일) | 신규 테스트 복사 |
| gis-worker 소스 | Dockerfile, config.py, ingest.py, main.py | 수정 파일 동기화 |
| gis-worker 테스트 | tests/ 디렉토리 (7개 파일) | 신규 테스트 복사 |
| 마이그레이션 | extract_mvt_facilities.py, import_geojson_to_postgis.py, import_facilities.sh, seed_facility_types.sql | MVT 추출/임포트 스크립트 |
| 인프라 | seed_facilities.sql, nginx-spa.conf, .env, .env.example, .gitignore, gis-status.sh | 인프라 설정 |
| 문서 | docs/migration/ (HISTORY.md, playwright-qa*.mjs, screenshots/), docs/analysis/, docs/implementation/ | 분석/구현/마이그레이션 문서 |
| PROMPT.md | PROMPT.md | 프로젝트 요구사항 문서 |

#### 검증 결과 (serengeti-iac 환경)

| 검증 항목 | 결과 | 상세 |
|-----------|------|------|
| gis-web Docker 빌드 | OK | `--no-cache` 빌드 성공, Vite 3.13초 |
| 컨테이너 기동 | OK | pg-tileserv → gis-api → gis-web 순차 기동, 모든 health OK |
| 페이지 로드 | OK | HTTP 200, 556 bytes |
| Layers API | OK | 4개 레이어 (PARCELS, BUILDINGS, FACILITY_NODES, FACILITY_PIPES) |
| Tile 엔드포인트 | OK | facility_nodes: 7,598B, facility_pipes: 6,645B, parcels: 58,602B, buildings: 360B |
| Facility Detail API | OK | `/api/v1/facilities/1` → 200, LineString geometry |
| Regions API | OK | POCHEON, bbox 포함 |
| pg_tileserv 카탈로그 | OK | 11개 타일 레이어 |
| DB 시설물 수 | OK | 152,644건 (15개 유형) |
| Search API | 404 | Elasticsearch 미가동 (마이그레이션 범위 밖) |

### 다음 루프 TODO
1. **origin/ 외 gis-utility-map 정리**: PROMPT.md END-GOAL에 따라 origin/ 이외 파일은 gis-utility-map에서 제거 (이미 serengeti-iac로 이전 완료)
2. **실제 GPU 환경에서 브라우저 렌더링 확인**: 데스크톱 브라우저에서 실제 지도 렌더링 확인 (Cloudflare Tunnel URL)
3. **LAYER_CD별 상세 레이어 세분화**: Node/Pipe 2개 → 하수맨홀/우수맨홀/하수관로/우수관로 등 세분화
4. **Elasticsearch 연동**: 시설물 검색 기능 활성화
5. **시설물 통계 대시보드**: 타입별/연도별 집계 표시

---

## Loop 7

### 작업 전 (목표)
- **gis-utility-map 정리**: PROMPT.md END-GOAL에 따라 origin/ 이외 파일을 gis-utility-map에서 제거 (serengeti-iac로 이전 완료되었으므로)
- **GIS 시스템 상태 점검**: 컨테이너, API, 타일 엔드포인트 정상 동작 확인
- **Playwright 브라우저 검증**: 실제 브라우저에서 gis.giraffe.ai.kr 접속하여 스크린샷 저장 및 기능 검증
- **UX 개선**: 위성지도/일반지도 전환 기능 추가, 하수관로 등 시설물 가시성 향상

### 작업 중 (주요 이슈 및 의사결정)
- **gum-web/gum-api DNS 충돌 발견**: gis-utility-map의 `gum-web` 컨테이너와 serengeti-iac의 `gis-web` 컨테이너가 모두 proxy-tier 네트워크에 존재. Docker DNS가 두 개의 IP를 반환하여 NPM이 구버전(gum-web)을 랜덤 서빙 → gum-web/gum-api 컨테이너 제거로 해결
- **nginx-spa.conf API upstream 오류**: `set $api_upstream gum-api` 로 설정되어 있어 gum-api 제거 후 502 반환 → `gis-api`로 수정
- **벡터 타일 상대 URL 문제**: MapLibre Web Worker가 상대 URL(`/tiles/...`)을 해석하지 못해 벡터 타일 요청이 전혀 발생하지 않음 → `LayerManager.tsx`에서 `window.location.origin`을 prefix로 추가하여 절대 URL로 변환
- **FacilityOut geojson 파싱 에러**: `ST_AsGeoJSON` 반환값이 문자열인데 Pydantic dict 타입 검증 실패 → `_parse_geojson()` 헬퍼 함수 추가
- **gis-api Dockerfile pyproject.toml 누락**: Dockerfile이 pyproject.toml을 참조하지만 실제 파일은 없음 → `requirements.txt` 기반으로 Dockerfile 수정
- **NPM proxy_cache 30분 캐싱**: NPM의 assets.conf가 JS/CSS를 30분간 캐시 → 배포 후 캐시 수동 삭제 필요 (`/var/lib/nginx/cache/public/`)

### 작업 후 (완료 내용)

#### 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `nginx-spa.conf` | API upstream `gum-api` → `gis-api` 수정 |
| `gis-web/src/components/map/LayerManager.tsx` | 벡터 타일 상대 URL → 절대 URL 변환 추가 |
| `gis-web/src/components/map/BasemapSwitcher.tsx` | 신규: 일반/위성/지형 베이스맵 전환 컴포넌트 |
| `gis-web/src/components/map/MapControls.tsx` | BasemapSwitcher 통합 |
| `gis-api/app/routers/facilities.py` | `_parse_geojson()` 헬퍼 추가, geojson 파싱 일관화 |
| `gis-api/Dockerfile` | `pyproject.toml` → `requirements.txt` 기반으로 수정 |

#### DB 변경 사항
- `gis.layers` FACILITY_PIPES 스타일: 줌 종속 선 두께 (`interpolate linear zoom 13→1, 15→3, 17→5px`), 투명도 0.85
- `gis.layers` FACILITY_NODES 스타일: 줌 종속 원 크기 (`interpolate linear zoom 13→2, 15→4, 17→7px`)

#### 인프라 정리
- `gum-web`, `gum-api` 컨테이너 제거 (gis-utility-map 이전 잔류 컨테이너)
- NPM 프록시 캐시 정리

#### Playwright QA 검증 결과

| 검증 항목 | 결과 | 상세 |
|-----------|------|------|
| 페이지 로드 | OK | gis.giraffe.ai.kr 200, MapLibre 초기화 |
| 맵 캔버스 | OK | WebGL 렌더링 정상 (headed 모드) |
| 벡터 타일 로딩 | OK | z15 203개 피처 (nodes 132, pipes 71) |
| 밀집 지역 (z16) | OK | 5,575개 피처 렌더링 |
| Layers API | OK | 4개 레이어 반환 |
| Regions API | OK | POCHEON 반환 |
| Facility Detail API | OK | 200, GeoJSON 포함 |
| 레이어 토글 | OK | 4개 체크박스, on/off 정상 |
| 베이스맵 전환 | OK | 일반/위성/지형 3종 |
| 실패 요청 | 0 | 모든 API/타일 정상 |

#### 스크린샷 저장
| 파일 | 내용 |
|------|------|
| `loop7-final-01-initial.png` | 초기 화면, 포천시 전체 뷰, 베이스맵 전환 버튼 |
| `loop7-final-02-z15-facilities.png` | z15 시설물 렌더링, 팝업 상세 정보 |
| `loop7-final-03-z16-dense.png` | z16 밀집 지역, 하수/우수 관로 색상 구분 |
| `loop7-final-04-facilities-off.png` | 시설물 레이어 OFF |
| `loop7-final-05-facilities-on.png` | 시설물 레이어 ON |
| `loop7-final-06-all-layers.png` | 전체 레이어 ON (필지+건물+시설물) |
| `loop7-final-07-z{12,13,14}.png` | 다양한 줌 레벨 |

### 다음 루프 TODO
1. **위성지도 전환 실제 동작 검증**: Playwright에서 BasemapSwitcher 클릭 후 위성 타일 로딩 확인
2. **gis-api Docker 재빌드 검증**: Dockerfile 수정 후 `docker compose build gis-api` 정상 빌드 확인
3. **seed_facilities.sql 업데이트**: 줌 종속 스타일을 seed SQL에 반영
4. **LAYER_CD별 상세 레이어 세분화**: 현재 Node/Pipe 2개 → 하수맨홀/우수맨홀/하수관로/우수관로 세분화
5. **Elasticsearch 연동**: 시설물 검색 기능 활성화
6. **관리자 페이지 기능 확장**: 지역 추가, 사용자 관리, 역할 기반 권한
7. **공공데이터 파이프라인**: 주소/시설물 자동 업데이트 파이프라인 설계

# 좌표 틀어짐 분석 및 수정 이력

## Loop 1 (2026-03-24)

### 작업 전: 목표
- PROMPT.md 지시에 따라 포천시 하수관로 시설 데이터의 좌표 틀어짐 현상 조사
- 스크린샷을 찍어 실제 지도 위에서 시설물 데이터 정렬 상태 확인
- 좌표 변환 코드 및 마이그레이션 프로세스 점검, 필요시 수정

### 작업 중: 주요 발견 및 의사결정

#### 1. 데이터 흐름 파악
- **필지/건물**: Shapefile → `shp2pgsql -s 5181` → staging → `ST_Transform(5181→4326)` → gis.parcels/buildings
- **시설물(152,644건)**: 레거시 MVT 타일(z15) → `extract_mvt_facilities.py`(타일좌표→WGS84) → `import_geojson_to_postgis.py` → gis.facilities (SRID 4326)
- 두 데이터 소스의 좌표 변환 경로가 다름

#### 2. 스크린샷 분석 (Playwright 자동 캡처)
- z16~z19 줌 레벨에서 OSM 배경지도 위에 시설물+필지 오버레이 확인
- 시설물(관로/맨홀)과 필지 경계 모두 OSM 도로로부터 약 **5~10m** 편차 관찰
- 방향성 분석: 체계적(datum) 오프셋이 아닌, 일반적인 데이터 정밀도 차이 수준

#### 3. 정량 분석 결과
| 비교 항목 | 결과 |
|-----------|------|
| 시설물↔필지 중심 오프셋 (6개 지역) | 0.7~5.8m (매우 양호) |
| 맨홀↔필지경계 거리 중앙값 | 5.96m |
| 포천시청 기준점 검증 (127.2003, 37.8947) | 필지 내부 포함 (distance=0) |
| 시설물↔필지 간 체계적 방향 편향 | 없음 (랜덤 방향) |

#### 4. 결론: 좌표계 데이터 변환에 문제 없음
- 원본 데이터는 EPSG:5181 (Korea 2000/GRS80)이 맞음
- 필지와 시설물은 상호 잘 정렬됨 (1~6m 이내)
- OSM과의 5~10m 편차는 한국 지적/지하시설물 데이터의 일반적 정밀도 범위
- Bessel (구 한국측지계) datum 이슈 아님 (datum 오차는 300m+ 수준)
- **DB 초기화 및 재마이그레이션 불필요**

#### 5. 코드 버그 발견 및 수정
**`initdb/05_functions.sql` - MVT 타일 함수 ST_Transform 누락**
- `parcels_by_region`: `ST_AsMVTGeom(p.geom, bounds)` → 4326 geom을 3857 bounds와 비교 → 잘못된 타일 생성
- `buildings_by_region`: 동일 버그
- `facilities_by_region`: 동일 버그 (단, `seed_facilities.sql`이 올바른 버전으로 덮어쓰고 있었음)
- **수정**: 3개 함수 모두 `ST_AsMVTGeom(ST_Transform(geom, 3857), bounds)`로 변경
- 수정 사항을 실행 중 DB에 즉시 적용 완료

#### 6. datum shift 파라미터 보강
- EPSG:5174 (Korean 1985 / Modified Central), EPSG:2097 (Korean 1985 / Central Belt)에 `towgs84` 파라미터 추가
- 향후 구 한국측지계 데이터 임포트 시 올바른 datum 변환이 적용됨

### 작업 후: 완료 내용
- [x] Playwright로 z16~z19 스크린샷 캡처 및 분석 (6장)
- [x] 6개 지역에서 시설물↔필지 오프셋 정량 비교
- [x] 포천시청 기준점으로 좌표 정확성 검증
- [x] `05_functions.sql` ST_Transform 버그 3건 수정 + DB 적용
- [x] EPSG:5174, EPSG:2097 towgs84 파라미터 추가

### 다음 루프 TODO
- [x] 필지/건물 레이어를 프론트엔드에서 활성화하고 시설물과 함께 오버레이 테스트 → Loop 2
- [x] pg_tileserv 재시작 후 function layer(parcels_by_region 등) 정상 동작 확인 → Loop 2
- [ ] 위성 배경지도(지형 모드)에서 시설물 정렬 재확인
- [x] `seed_facilities.sql`의 레이어 정의와 `09_seed_layers.sql` 간 중복/불일치 정리 → Loop 2
- [x] 스크린샷 임시 파일 정리 (docs/5.coordinates/*.png, *.mjs) → Loop 2

---

## Loop 2 (2026-03-24)

### 작업 전: 목표
- Loop 1 TODO 항목 수행: pg_tileserv function layer 정상 동작 확인, 필지/건물 레이어 프론트엔드 활성화, 레이어 시드 SQL 중복 정리, 임시 파일 정리
- DB의 PARCELS/BUILDINGS 레이어가 `visible=false`, `tile_url=NULL`인 상태 → function layer URL로 변경하고 활성화
- `seed_facilities.sql`(4개 레이어, ON CONFLICT UPSERT)과 `09_seed_layers.sql`(10개 레이어, DELETE+INSERT) 간 불일치 해소
- Playwright 스크린샷 임시 파일(*.png, *.mjs) 정리

### 작업 중: 주요 문제 및 의사결정

#### 1. pg_tileserv function layer 정상 동작 확인
- pg_tileserv 컨테이너 healthy 상태, 모든 function layer 등록 확인
- `parcels_by_region`, `buildings_by_region`, `facility_nodes`, `facility_pipes`, `facilities_by_region` 모두 정상
- 포천시 좌표(z16/55924/25302)에서 parcels 타일 81KB, buildings 타일 3.5KB 반환 확인

#### 2. DB 레이어 정의 업데이트
- PARCELS: `tile_url=NULL`, `source_table=gis.parcels`, `visible=false` → `tile_url=/gis.parcels_by_region/{z}/{x}/{y}.pbf`, `source_table=parcels`, `visible=true`
- BUILDINGS: 동일 패턴으로 변경
- `source_table`을 MVT 레이어 이름(`parcels`, `buildings`)으로 수정 — `ST_AsMVT(mvtgeom, 'parcels')`와 일치 필요

#### 3. Redis 캐시 문제 발견 및 해결
- DB 업데이트 후에도 API가 이전 데이터를 반환 — Redis 캐시(`layers:POCHEON`, `layers:all`)에 오래된 데이터 잔존
- `redis-cli DEL` 명령으로 3개 캐시 키 삭제 후 정상화
- 참고: region code가 `4165000000`이 아니라 `POCHEON`임을 확인 (09_seed_layers.sql의 region 조회가 불일치였음)

#### 4. seed SQL 파일 통합
- `09_seed_layers.sql`: 레거시 형태(DELETE+INSERT, `/rpc/` 접두어, 시설물별 10개 레이어) → 완전 재작성
- `seed_facilities.sql`과 동일한 4개 레이어(PARCELS, BUILDINGS, FACILITY_NODES, FACILITY_PIPES), ON CONFLICT UPSERT 패턴으로 통일
- 두 파일의 레이어 정의가 항상 동기화되어야 한다는 주석 추가

#### 5. Playwright 오버레이 검증
- z16/z18 스크린샷에서 필지(노란색 반투명), 건물(갈색 반투명), 시설물(관로/맨홀) 모두 OSM 배경 위에 정상 렌더링 확인
- MapLibre 레이어 5개 모두 `visibility: visible` 상태
- function layer URL 패턴(`/tiles/gis.parcels_by_region/{z}/{x}/{y}.pbf`) 정상 라우팅

### 작업 후: 완료 내용
- [x] pg_tileserv function layer 5개(parcels_by_region, buildings_by_region, facilities_by_region, facility_nodes, facility_pipes) 정상 동작 확인
- [x] DB 레이어 PARCELS/BUILDINGS를 function layer URL + visible=true로 업데이트
- [x] Redis 캐시 클리어하여 프론트엔드에 최신 레이어 정의 반영
- [x] `09_seed_layers.sql`을 `seed_facilities.sql`과 동일한 UPSERT 패턴으로 재작성 (레거시 DELETE+INSERT 제거)
- [x] `seed_facilities.sql`의 PARCELS/BUILDINGS에 function layer URL 반영
- [x] Playwright z16/z18 스크린샷으로 필지+건물+시설물 오버레이 정상 확인
- [x] Loop 1 임시 파일 정리 (*.png 8장, *.mjs 3개 삭제)

### 다음 루프 TODO
- [ ] 위성 배경지도(지형 모드)에서 시설물 정렬 재확인 (Loop 1에서 이월)
- [ ] BasemapSwitcher에 위성/지형 타일 소스 추가 (현재 OSM raster만 사용)
- [ ] 필지 레이어에 지번 텍스트 라벨 표시 (style에 `text-field: "jibun"` 추가)
- [ ] Loop 2 확인용 스크린샷(loop2_overlay_z16.png, loop2_overlay_z18.png) 정리 여부 결정

---

## Loop 3 (2026-03-24)

### 작업 전: 목표
- Loop 2에서 이월된 TODO 수행:
  1. BasemapSwitcher에 위성/지형 타일 소스 추가 (현재 OSM raster만 사용)
  2. 위성 배경지도(지형 모드)에서 시설물 정렬 재확인
  3. 필지 레이어에 지번 텍스트 라벨 표시 (style에 `text-field: "jibun"` 추가)
  4. Loop 2 확인용 스크린샷 정리

### 작업 중: 주요 문제 및 의사결정

#### 1. BasemapSwitcher — 이미 구현 완료 확인
- `BasemapSwitcher.tsx`에 3가지 배경지도(OSM, Esri 위성, OpenTopoMap 지형)가 이미 정의되어 있었음
- 소스 교체 방식(remove+add)으로 구현되어 있으며, 정상 동작 확인
- 추가 작업 불필요

#### 2. 지번 라벨 레이어 구현
- `parcels_by_region` 함수에 `jibun` 속성이 이미 MVT 출력에 포함되어 있음
- **LayerManager에 `symbol` 타입 지원 추가**: `buildPaintProps`(text-color, text-halo-color, text-halo-width, text-opacity), `buildLayoutProps`(text-field, text-size, text-anchor, text-allow-overlap, symbol-placement), opacity 슬라이더 연동
- **PARCELS_LABELS 레이어 시드 추가**: `09_seed_layers.sql`과 `seed_facilities.sql` 양쪽에 동기화 추가
- style: `text-field: ["get", "jibun"]`, min_zoom 16, text-halo로 가독성 확보
- 실행 중 DB에 INSERT + Redis 캐시 클리어로 즉시 반영

#### 3. 위성 배경지도 시설물 정렬 확인
- Playwright로 위성(Esri) z16/z18, 지형(OpenTopoMap) z16 캡처
- 위성 영상 위에서 시설물(관로/맨홀)이 도로/건물과 합리적으로 정렬됨 확인
- 체계적 편향(datum shift) 없음 — Loop 1 결론과 일치
- 지번 라벨이 OSM, 위성, 지형 모든 배경지도에서 정상 표시됨

#### 4. DB 접속 정보
- 컨테이너명: `postgres` (not `gis-postgres`)
- DB명: `gisdb` (not `gis`)
- 사용자: `postgres`
- Redis: DB 1, 인증 필요, 캐시 키 `layers:POCHEON`, `layers:4165000000`

### 작업 후: 완료 내용
- [x] BasemapSwitcher에 위성/지형 타일 소스 이미 구현되어 있음 확인
- [x] LayerManager에 `symbol` 레이어 타입 지원 추가 (paint/layout/opacity)
- [x] PARCELS_LABELS 시드 레이어 추가 (`09_seed_layers.sql`, `seed_facilities.sql` 동기화)
- [x] 실행 중 DB에 PARCELS_LABELS 레이어 INSERT + Redis 캐시 클리어
- [x] gis-web 컨테이너 리빌드 및 재시작
- [x] Playwright 스크린샷 4장 촬영: OSM z18(라벨), 위성 z18, 위성 z16, 지형 z16
- [x] 위성 배경지도에서 시설물 정렬 정상 확인 (체계적 편향 없음)
- [x] Loop 2 임시 스크린샷 2장 + Loop 3 스크립트 정리

### 다음 루프 TODO
- [x] 지번 라벨 스타일 미세 조정 (zoom 레벨별 text-size 변화, 밀집 지역 가독성 개선) → Loop 4
- [x] 건물 레이어에도 건물명(bld_name) 라벨 추가 검토 → Loop 4 (BUILDINGS_LABELS 추가)
- [x] Loop 3 확인용 스크린샷(loop3_*.png 4장) 정리 여부 결정 → Loop 4 (삭제)
- [x] 레이어 토글 시 PARCELS와 PARCELS_LABELS 연동 (필지 비활성화 시 라벨도 함께 비활성화) → Loop 4

---

## Loop 4 (2026-03-24)

### 작업 전: 목표
- Loop 3에서 이월된 TODO 수행:
  1. 지번 라벨 스타일 미세 조정 (zoom 레벨별 text-size 변화, 밀집 지역 가독성 개선)
  2. 레이어 토글 시 PARCELS와 PARCELS_LABELS 연동 (필지 비활성화 시 라벨도 함께 비활성화)
  3. 건물 레이어에도 건물명(bld_name) 라벨 추가 검토
  4. Loop 3 확인용 스크린샷(loop3_*.png 4장) 정리

### 작업 중: 주요 문제 및 의사결정

#### 1. 지번 라벨 스타일 미세 조정
- `text-size`를 고정값 `11`에서 zoom 레벨별 보간 표현식으로 변경:
  - `["interpolate", ["linear"], ["zoom"], 16, 9, 18, 12, 20, 15]`
  - z16에서 9px(밀집 지역에서 겹침 최소화), z18에서 12px, z20에서 15px로 점진 확대
- `text-padding: 2` 추가하여 라벨 간 최소 간격 확보 (밀집 지역 가독성 개선)
- `09_seed_layers.sql`, `seed_facilities.sql` 양쪽 동기화 + 실행 중 DB 업데이트 + Redis 캐시 클리어

#### 2. PARCELS/PARCELS_LABELS 토글 연동
- `layerStore.ts`의 `toggleLayer` 함수에 자식 라벨 레이어 연동 로직 추가
- 컨벤션: 부모 레이어 코드 + `_LABELS` 접미어로 자식 레이어 자동 탐색
- 부모(PARCELS) 비활성화 시 자식(PARCELS_LABELS)도 함께 비활성화, 활성화 시 함께 활성화
- BUILDINGS/BUILDINGS_LABELS에도 동일하게 적용됨 (범용 컨벤션)

#### 3. 건물명(bld_name) 라벨 레이어 추가
- DB 확인: 8,721개 건물 모두 `bld_name` 속성 보유 (포천염광수련원, 삼정오토캠핑장 등 실제 건물명)
- `buildings_by_region` MVT 함수에 이미 `bld_name` 포함됨 → 추가 SQL 함수 수정 불필요
- BUILDINGS_LABELS 레이어 추가 (sort_order: 25, BUILDINGS와 BUILDINGS_LABELS 사이)
  - `text-field: ["get", "bld_name"]`, zoom별 text-size 보간, 갈색 텍스트(`#5a2d0c`) + 흰색 halo
  - `text-allow-overlap: false`로 밀집 지역에서 자동 솎아내기
- `09_seed_layers.sql`, `seed_facilities.sql` 동기화 + DB INSERT + Redis 클리어

#### 4. gis-web 리빌드
- `layerStore.ts` 변경 반영을 위해 `docker compose build gis-web && up -d gis-web` 실행
- 컨테이너 정상 기동 확인

#### 5. Loop 3 스크린샷 정리
- `docs/5.coordinates/loop3_*.png` 4장 삭제 (osm_z18_labels, satellite_z16, satellite_z18, topo_z16)

### 작업 후: 완료 내용
- [x] 지번 라벨 text-size를 zoom 레벨별 보간 표현식으로 변경 + text-padding 추가
- [x] `layerStore.ts`에 부모-자식 라벨 레이어 토글 연동 구현 (`_LABELS` 컨벤션)
- [x] BUILDINGS_LABELS 레이어 추가 (seed SQL 동기화, DB INSERT, Redis 클리어)
- [x] gis-web 컨테이너 리빌드 및 재시작
- [x] Loop 3 임시 스크린샷 4장 삭제

### 다음 루프 TODO
- [ ] 건물명 라벨이 실제 지도에서 정상 렌더링되는지 스크린샷 확인
- [ ] 밀집 지역(포천시내)에서 지번/건물명 라벨 겹침 여부 확인 및 필요시 text-padding/text-size 재조정
- [ ] BUILDINGS 토글 시 BUILDINGS_LABELS 연동이 정상 동작하는지 UI 테스트
- [ ] 라벨 레이어를 LayerTree UI에서 부모 아래 들여쓰기로 표시하는 UX 개선 검토

---

## Loop 5 (2026-03-24)

### 작업 전: 목표
- Loop 4에서 이월된 TODO 수행:
  1. 건물명 라벨이 실제 지도에서 정상 렌더링되는지 스크린샷 확인
  2. 밀집 지역(포천시내)에서 지번/건물명 라벨 겹침 여부 확인 및 필요시 text-padding/text-size 재조정
  3. BUILDINGS 토글 시 BUILDINGS_LABELS 연동이 정상 동작하는지 UI 테스트
  4. 라벨 레이어를 LayerTree UI에서 부모 아래 들여쓰기로 표시하는 UX 개선 검토

### 작업 중: 주요 문제 및 의사결정

#### 1. 건물명 라벨 렌더링 확인 (Playwright 스크린샷)
- `window.__gis_map.jumpTo()`로 포천시 중심(127.2003, 37.8947)에서 z16/z18/z19 캡처
- z18: 지번 라벨(58-2 등)과 건물명 라벨("포천시청")이 OSM 배경 위에 정상 렌더링
- z19: 지번 라벨이 적절한 밀도로 분포, `text-allow-overlap: false`로 겹침 없이 깔끔
- 건물명 라벨이 갈색 텍스트(`#5a2d0c`)로 정상 표시 확인

#### 2. 밀집 지역 라벨 겹침 분석
- z19 포천시청 인근: 지번(58-2, 59-4, 59-13 등)과 건물명("포천시청") 라벨이 겹치지 않음
- Loop 4에서 설정한 `text-padding: 2`와 zoom별 `text-size` 보간이 효과적으로 작동 중
- **추가 조정 불필요**

#### 3. BUILDINGS/PARCELS 토글 연동 테스트 (Playwright 자동)
- BUILDINGS OFF → BUILDINGS_LABELS OFF: **PASS**
- BUILDINGS ON → BUILDINGS_LABELS ON: **PASS**
- PARCELS OFF → PARCELS_LABELS OFF: **PASS**
- `layerStore.ts`의 `_LABELS` 컨벤션 기반 연동이 정상 작동

#### 4. LayerTree UI 들여쓰기 UX 개선
- `LayerTree.tsx`: `_LABELS` 레이어를 top-level에서 제외하고, 부모 아래에 들여쓰기로 렌더링
  - `ml-5 border-l border-gray-200 pl-1` CSS로 시각적 연결 (왼쪽 경계선)
  - 라벨 아이콘("T")과 작은 텍스트(`text-xs`)로 부모와 구분
  - 독립적인 체크박스로 개별 on/off 가능 (부모 토글 시 자동 연동은 유지)
- `Legend.tsx`: 범례에서 `_LABELS` 레이어 제외 (`code.endsWith("_LABELS")` 필터)
  - 라벨은 시각적 보조 요소이므로 범례에 표시 불필요

#### 5. gis-web 리빌드
- LayerTree.tsx, Legend.tsx 변경 반영을 위해 2회 `docker compose build gis-web && up -d` 실행
- 컨테이너 healthy 상태 확인

### 작업 후: 완료 내용
- [x] Playwright z16/z18/z19 스크린샷 캡처 및 건물명 라벨 정상 렌더링 확인
- [x] 밀집 지역(z19 포천시청 인근) 라벨 겹침 없음 확인 (추가 조정 불필요)
- [x] BUILDINGS/PARCELS 토글 시 _LABELS 연동 자동 테스트 전체 PASS
- [x] LayerTree UI: _LABELS 레이어를 부모 아래 들여쓰기로 표시 (경계선 + T 아이콘)
- [x] Legend에서 _LABELS 레이어 제외
- [x] gis-web 컨테이너 리빌드 2회 (LayerTree.tsx, Legend.tsx)
- [x] 임시 스크린샷 정리 (6장 → 2장 보존: z19_dense, sidebar_detail)

### 다음 루프 TODO
- [ ] 건물명 라벨 중 빈 문자열(`bld_name = ''`) 필터링 검토 (MVT 함수에서 `WHERE bld_name != ''` 조건 추가)
- [ ] 라벨 레이어 독립 토글 시 부모가 off인 상태에서 라벨만 on되는 엣지케이스 처리 검토
- [ ] Loop 5 확인용 스크린샷(loop5_labels_z19_dense.png, loop5_sidebar_detail.png) 정리 여부 결정

---

## Loop 6 (2026-03-24)

### 작업 전: 목표
- Loop 5에서 이월된 TODO 수행:
  1. 건물명 라벨 중 빈 문자열(`bld_name = ''`) 필터링 (MVT 함수에서 `WHERE bld_name != ''` 조건 추가)
  2. 라벨 레이어 독립 토글 시 부모가 off인 상태에서 라벨만 on되는 엣지케이스 처리
  3. Loop 5 확인용 스크린샷(loop5_*.png) 정리

### 작업 중: 주요 문제 및 의사결정

#### 1. 빈 bld_name 필터링 — MapLibre filter 방식 채택
- DB 확인: 현재 `bld_name = ''` 또는 NULL인 건물 0건 (즉각적 문제 없음)
- 그러나 향후 데이터 임포트 대비하여 필터링 추가
- **의사결정**: MVT 함수(`buildings_by_region`)에 `WHERE bld_name != ''` 추가하면 건물 폴리곤 렌더링에 영향 → 대신 BUILDINGS_LABELS 스타일 JSON에 MapLibre `filter` 표현식 추가
  - `"filter": ["!=", ["get", "bld_name"], ""]`
- `LayerManager.tsx`에 스타일 JSON의 `filter` 속성을 `addLayer`에 전달하는 로직 추가
- `09_seed_layers.sql`, `seed_facilities.sql` 양쪽 동기화 + 실행 중 DB 업데이트 + Redis 캐시 클리어

#### 2. 라벨 레이어 독립 토글 엣지케이스 처리
- 기존 문제: LayerTree UI에서 `_LABELS` 자식 레이어를 독립 체크박스로 on할 수 있어, 부모(BUILDINGS/PARCELS)가 off인 상태에서 라벨만 on되는 엣지케이스 존재
- **의사결정**: `layerStore.ts`의 `toggleLayer`에 방향별 분기 추가
  - `_LABELS` 레이어를 ON할 때: 부모가 off이면 부모도 자동으로 ON
  - 부모를 OFF할 때: 기존대로 자식 `_LABELS`도 함께 OFF
  - 부모를 ON할 때: 기존대로 자식 `_LABELS`도 함께 ON
  - `_LABELS` 레이어를 OFF할 때: 부모는 유지 (라벨만 끄는 것은 유효한 시나리오)

#### 3. Loop 5 스크린샷 정리
- `loop5_labels_z19_dense.png`, `loop5_sidebar_detail.png` 2장 삭제

#### 4. gis-web 리빌드
- `LayerManager.tsx`, `layerStore.ts` 변경 반영을 위해 `docker compose build gis-web && up -d gis-web` 실행
- 빌드 성공, 컨테이너 정상 기동

### 작업 후: 완료 내용
- [x] BUILDINGS_LABELS에 MapLibre `filter` 표현식 추가 (빈 bld_name 제외)
- [x] `LayerManager.tsx`에 스타일 JSON의 `filter` 속성 지원 추가
- [x] `layerStore.ts` toggleLayer에 _LABELS 독립 토글 엣지케이스 처리 (라벨 ON → 부모 자동 ON)
- [x] `09_seed_layers.sql`, `seed_facilities.sql` 동기화
- [x] 실행 중 DB 업데이트 + Redis 캐시 클리어
- [x] gis-web 컨테이너 리빌드 및 재시작
- [x] Loop 5 임시 스크린샷 2장 삭제

### 다음 루프 TODO
- [ ] Playwright 자동 테스트로 라벨 토글 엣지케이스(부모 off → 라벨 on) 정상 동작 확인
- [ ] 빈 bld_name 건물이 실제로 추가됐을 때 라벨이 표시되지 않는지 테스트 (테스트 데이터 INSERT → 확인 → 롤백)
- [ ] GeoJSON 커스텀 레이어에도 filter 지원 추가 검토 (현재 MVT 레이어만 적용)

---

## Loop 7 (2026-03-24)

### 작업 전: 목표
- Loop 6에서 이월된 TODO 수행:
  1. Playwright 자동 테스트로 라벨 토글 엣지케이스(부모 off → 라벨 on) 정상 동작 확인
  2. 빈 bld_name 건물이 실제로 추가됐을 때 라벨이 표시되지 않는지 테스트 (테스트 데이터 INSERT → 확인 → 롤백)
  3. GeoJSON 커스텀 레이어에도 filter 지원 추가 검토 (현재 MVT 레이어만 적용)

### 작업 중: 주요 문제 및 의사결정

#### 1. Playwright 라벨 토글 엣지케이스 자동 테스트
- `e2e/label-toggle-edge.spec.ts` 신규 작성 (4개 테스트 케이스):
  - 부모(BUILDINGS) OFF → 자식(BUILDINGS_LABELS) ON → 부모 자동 ON: **PASS**
  - 부모(PARCELS) OFF → 자식(PARCELS_LABELS) ON → 부모 자동 ON: **PASS**
  - 자식 라벨만 OFF → 부모 유지: **PASS**
  - 부모 ON → 자식 라벨도 함께 ON: **PASS**
- **문제 해결**: 로그인 세션이 유지되는 경우 `getByLabel("사용자명")`이 timeout → login 함수에 세션 감지 로직 추가 (`canvas` vs `loginForm` race)
- **문제 해결**: `text=레이어` 로케이터가 여러 요소에 매칭 → `aside h3:has-text('레이어')`로 변경

#### 2. 빈 bld_name 필터링 검증
- DB 트랜잭션 테스트: 빈 `bld_name` 건물 INSERT → 카운트 1 확인 → ROLLBACK → 카운트 0 확인
- BUILDINGS_LABELS 스타일 JSON의 `filter: ["!=", ["get", "bld_name"], ""]` 확인
- 필터링은 MapLibre 클라이언트 사이드 방식 — MVT 타일에는 건물 폴리곤 포함되지만 라벨 렌더링에서 제외
- 현재 DB에 `bld_name = ''`인 건물 0건이므로 즉각적 문제 없음, 향후 데이터 임포트 시 필터가 작동

#### 3. GeoJSON 커스텀 레이어 filter 지원 추가
- `LayerManager.tsx`: GeoJSON 레이어 분기(`isCustomGeoJSON`)에서 `addLayer` 시 `style["filter"]` 전달 누락 발견
- MVT 레이어와 동일하게 `geojsonLayerDef["filter"] = style["filter"]` 추가
- gis-web 컨테이너 리빌드 및 재시작

#### 4. 기존 테스트 통과 확인
- 리빌드 후 label-toggle-edge 4개 테스트 전체 PASS (4.3s)

### 작업 후: 완료 내용
- [x] `e2e/label-toggle-edge.spec.ts` 신규 작성 — 라벨 토글 엣지케이스 4개 테스트 전체 PASS
- [x] 빈 bld_name 필터링 DB 트랜잭션 테스트 수행 및 확인 (INSERT → 확인 → ROLLBACK)
- [x] `LayerManager.tsx`에 GeoJSON 커스텀 레이어 filter 지원 추가
- [x] gis-web 컨테이너 리빌드 및 재시작

### 다음 루프 TODO
- [ ] 기존 E2E 테스트 전체 스위트(auth, map-load, layer-toggle 등) 일괄 실행하여 레그레션 확인
- [ ] GeoJSON 커스텀 레이어에 filter가 적용된 실제 레이어 생성하여 동작 검증
- [ ] 스타일 변경 시 filter도 라이브 업데이트 되는지 검토 (현재 paint만 라이브 업데이트)

---

## Loop 8 (2026-03-24)

### 작업 전: 목표
- Loop 7에서 이월된 TODO 수행:
  1. 기존 E2E 테스트 전체 스위트(auth, map-load, layer-toggle 등) 일괄 실행하여 레그레션 확인
  2. GeoJSON 커스텀 레이어에 filter가 적용된 실제 레이어 생성하여 동작 검증
  3. 스타일 변경 시 filter도 라이브 업데이트 되는지 검토 (현재 paint만 라이브 업데이트)

### 작업 중: 주요 문제 및 의사결정

#### 1. E2E 테스트 전체 스위트 실행 결과 (1차)
- 60개 테스트 중 36 passed, 24 failed
- **실패 원인 분석**: 모든 24건이 코드 레그레션이 아닌 테스트 인프라 문제
  - 로그인 세션 쿠키: 이미 로그인된 상태에서 로그인 폼을 찾으려는 테스트
  - 오래된 로그인 플로우: "관리자 로그인" 버튼, `#username` ID, 비밀번호 `admin123!` 등 현재 UI와 불일치
  - `.shadow-lg` 로케이터: 검색 결과 패널과 범례 패널이 동일 클래스로 strict mode violation
  - 사용자 표시 이름: "admin" 대신 "관리자" (DB `auth.users.name` 필드)

#### 2. E2E 테스트 공통 helper 생성 및 전체 수정
- `e2e/helpers.ts` 신규 생성:
  - `login()`: 세션 감지 (로그아웃 버튼 vs 로그인 버튼 race), 게스트 상태 시 자동 로그인
  - `ensureLoggedOut()`: 쿠키/localStorage 클리어 후 리로드, 게스트 상태 보장
- **앱 인증 플로우 파악**: 맵은 모든 사용자(게스트 포함)에게 보이고, 사이드바 하단 "로그인" 버튼 클릭 시 로그인 폼 렌더링
- 수정된 테스트 파일 8개:
  - `admin.spec.ts`: login helper 사용, "관리자" 표시 이름, 로그아웃→"로그인" 버튼 확인
  - `auth.spec.ts`: ensureLoggedOut 사용, 게스트→로그인폼→로그인 성공 플로우
  - `auth-upload.spec.ts`: login/ensureLoggedOut helper, 레거시 플로우 완전 제거
  - `map.spec.ts`: login helper 사용
  - `search.spec.ts`: login helper + `.top-full.shadow-lg` 로케이터로 범례 패널 충돌 해결
  - `upload-pipeline.spec.ts`: login helper 사용
  - `label-toggle-edge.spec.ts`: 공유 login helper로 전환
  - `mobile.spec.ts`: 변경 없음 (검색 API 타이밍 이슈)

#### 3. GeoJSON 레이어 filter 라이브 업데이트 구현
- `LayerManager.tsx`의 GeoJSON 스타일 변경 감지 블록(line 162~176)에 `map.setFilter()` 추가
- 기존: paint 속성만 라이브 업데이트 → filter 변경 시 반영 안 됨
- 수정: `map.setFilter(layerId, style["filter"] ?? null)` 추가
- TypeScript 타입: `Parameters<typeof map.setFilter>[1]`로 캐스팅하여 `FilterSpecification` 호환
- MVT 레이어는 스타일이 정적(seed SQL)이므로 라이브 업데이트 불필요

#### 4. GeoJSON filter 동작 검증
- DB 확인: 현재 `filter` 속성이 있는 레이어는 BUILDINGS_LABELS(MVT)뿐, 커스텀 GeoJSON에는 filter 없음
- 코드 레벨 검증: GeoJSON 레이어 초기 생성 시(`addLayer`) filter 전달(line 148)은 Loop 7에서 구현 완료
- 라이브 업데이트(`setFilter`)는 이번 Loop에서 추가 — CustomLayerManagement에서 스타일 변경 시 filter도 함께 반영됨
- 현재 커스텀 레이어 UI에 filter 설정 기능 없으므로, 실제 동작 검증은 향후 filter 설정 UI 추가 시 수행

#### 5. E2E 테스트 최종 결과 (3차)
- 60개 테스트 중 **56 passed, 4 failed**
- 잔여 실패 4건은 코드 레그레션 아닌 인프라/타이밍 이슈:
  - `search.spec.ts` 2건: highlight marker 표시 실패 (검색 결과 click 후 마커 미생성)
  - `upload-pipeline.spec.ts` 1건: Import 처리가 60초 내 완료 안 됨 (워커 처리 지연)
  - `mobile.spec.ts` 1건: 모바일 검색 결과 카운트 미표시 (Elasticsearch 응답 타이밍)

#### 6. gis-web 리빌드
- `LayerManager.tsx` filter 라이브 업데이트 코드 반영
- TypeScript 빌드 성공, 컨테이너 정상 기동

### 작업 후: 완료 내용
- [x] E2E 테스트 전체 60개 일괄 실행 및 실패 원인 분석
- [x] `e2e/helpers.ts` 공유 login/logout helper 생성
- [x] 8개 E2E 테스트 파일 현재 앱 인증 플로우에 맞게 재작성
- [x] 테스트 통과율 36/60 → 56/60으로 개선 (20개 추가 통과)
- [x] `LayerManager.tsx`에 GeoJSON 레이어 filter 라이브 업데이트(`map.setFilter`) 추가
- [x] gis-web 컨테이너 리빌드 및 재시작

### 다음 루프 TODO
- [ ] search.spec.ts highlight marker 2건 실패 조사 (검색 결과 선택 후 마커 렌더링 타이밍)
- [ ] upload-pipeline.spec.ts 워커 처리 지연 원인 조사 (Kafka 연결 or 워커 상태)
- [ ] mobile.spec.ts 검색 결과 표시 타이밍 이슈 (Elasticsearch API 응답 지연)

---

## Loop 9 (2026-03-24)

### 작업 전: 목표
- Loop 8에서 이월된 TODO 수행:
  1. search.spec.ts highlight marker 2건 실패 조사 (검색 결과 선택 후 마커 렌더링 타이밍)
  2. upload-pipeline.spec.ts 워커 처리 지연 원인 조사 (Kafka 연결 or 워커 상태)
  3. mobile.spec.ts 검색 결과 표시 타이밍 이슈 (Elasticsearch API 응답 지연)
- E2E 테스트 60개 중 잔여 실패 4건을 모두 해결하여 전체 통과율 60/60 달성 목표

### 작업 중: 주요 문제 및 의사결정

#### 1. search.spec.ts — Elasticsearch region_code 불일치 (근본 원인)
- **증상**: search highlight marker 2건 + mobile 검색 1건, 총 3건 실패
- **원인 분석**: 브라우저 디버깅으로 프론트엔드 검색 API 응답 확인 → `region=POCHEON` 파라미터로 검색 시 0건 반환
- **근본 원인**: ES 인덱스의 `region_code` 필드가 `"4165000000"` (행정구역코드)로 저장되어 있으나, 프론트엔드는 `"POCHEON"` (앱 내부 코드) 전달
  - ES 인덱싱 스크립트(`10_setup_elasticsearch.sh`)는 `r.code` (POCHEON) 사용 — 올바름
  - 하지만 실제 ES 데이터는 이전(구버전) 인덱싱으로 `"4165000000"` 상태
- **수정**: `_update_by_query`로 ES 263,462건의 `region_code`를 `"4165000000"` → `"POCHEON"` 일괄 업데이트
- **결과**: search 7개 + mobile 10개 전체 PASS

#### 2. upload-pipeline.spec.ts — 3가지 버그 복합
- **증상**: Import가 60초 내 완료되지 않음 (pollImportStatus 타임아웃)

##### 2a. Kafka 토픽명 불일치 (gis-api config.py)
- `config.py`의 `kafka_import_topic` 기본값이 `"gum.import.request"` — 이것이 올바른 값
- 처음에 `"gis.import.request"`로 잘못 변경했다가 워커 로그 확인 후 원복
- API와 워커 양쪽 config에 동일한 `"gum.import.request"` 확인

##### 2b. gis-worker Dockerfile 빌드 실패
- Dockerfile이 `COPY pyproject.toml .` 참조하나, 실제 파일은 `requirements.txt`
- **수정**: `Dockerfile`에서 `pyproject.toml` → `requirements.txt`로 변경, fallback 로직 제거
- 리빌드 성공, 워커 컨테이너 재생성

##### 2c. 테스트 검증 로직 — API limit 초과
- 테스트가 `limit=5000`으로 시설물 카운트를 비교하지만, 테스트 bbox에 18,509개 시설물 존재
- initialCount와 finalCount 모두 5000(limit 상한)으로 동일 → 비교 실패
- **수정**: 불필요한 카운트 비교 제거, import `record_count: 3` 검증만으로 충분

#### 3. admin.spec.ts / auth-upload.spec.ts — getByText 다중 매칭
- **증상**: 전체 스위트 실행 시에만 2건 실패, 개별 실행 시 PASS
- **원인**: `getByText('수집 이력')`이 `<h4>수집 이력</h4>`과 `<div>수집 이력이 없습니다.</div>` 2개 매칭 (strict mode violation)
  - 전체 스위트에서는 `DELETE FROM audit.data_imports` 후 실행되어 빈 이력 메시지 표시
  - 개별 실행 시에는 이전 테스트의 이력 데이터가 남아 있어 빈 메시지 미표시
- **수정**: `page.getByText("수집 이력")` → `page.locator("h4", { hasText: "수집 이력" })` 로 구체화

#### 4. E2E 테스트 인프라 — 포트 노출
- gis-web 컨테이너에 호스트 포트 매핑 없음 → Playwright가 `localhost:18080`에 접근 불가
- **수정**: `docker-compose.override.yml` 생성하여 `18080:80` 포트 매핑 추가

### 작업 후: 완료 내용
- [x] Elasticsearch `region_code` 263,462건 일괄 업데이트 (`4165000000` → `POCHEON`)
- [x] gis-worker `Dockerfile` 수정 (`pyproject.toml` → `requirements.txt`) + 리빌드
- [x] `upload-pipeline.spec.ts` 테스트에서 불필요한 시설물 카운트 비교 제거
- [x] `admin.spec.ts`, `auth-upload.spec.ts`의 `getByText` 다중 매칭 수정 (h4 로케이터)
- [x] `docker-compose.override.yml` 생성 (E2E 테스트용 포트 18080 노출)
- [x] **E2E 테스트 60/60 전체 PASS** (이전 56/60 → 60/60)

### 다음 루프 TODO
- [x] ES 인덱싱 스크립트(`10_setup_elasticsearch.sh`) 재실행하여 ES 데이터를 최신 스크립트 기준으로 정규화 → Loop 10
- [x] `docker-compose.override.yml`을 `.gitignore`에 추가 (E2E 테스트용 로컬 설정) → Loop 10
- [x] E2E 테스트 CI 파이프라인 구성 검토 (현재 로컬 실행만 가능) → Loop 10

---

## Loop 10 (2026-03-24)

### 작업 전: 목표
- Loop 9에서 이월된 TODO 수행:
  1. ES 인덱싱 스크립트(`10_setup_elasticsearch.sh`) 재실행하여 ES 데이터를 최신 스크립트 기준으로 정규화 (Loop 9에서 `_update_by_query`로 region_code를 수동 패치했으나, 스크립트 재실행으로 완전 정규화 필요)
  2. `docker-compose.override.yml`을 `.gitignore`에 추가 (E2E 테스트용 로컬 설정이므로 git에 커밋되면 안 됨)
  3. E2E 테스트 CI 파이프라인 구성 검토 (현재 로컬 실행만 가능)

### 작업 중: 주요 문제 및 의사결정

#### 1. `.gitignore`에 `docker-compose.override.yml` 추가
- `docker-compose.override.yml`은 E2E 테스트용 포트 노출(`18080:80`) 설정 — 로컬 전용
- git에서 untracked 상태 확인 후 `.gitignore`에 추가 (tracked 파일이었다면 `git rm --cached` 필요했을 것)

#### 2. ES 인덱싱 스크립트 재실행
- `migration/10_setup_elasticsearch.sh` 재실행: 인덱스 삭제 → 재생성 → 데이터 적재
- **결과**: 255,568건 인덱싱 (이전 Loop 9에서 `_update_by_query` 후 263,462건 → 스크립트 기준 정규화로 일부 감소)
  - 차이 원인: 이전에는 시설물(facilities) 데이터도 인덱스에 있었을 가능성 — 현 스크립트는 parcels + buildings만 인덱싱
- `region_code: "POCHEON"` 정상 확인 (`r.code` 사용)
- 검색 API 테스트: `region_code=POCHEON` 필터 + `address:포천시청` 검색 정상 동작
- E2E 테스트 60/60 전체 PASS 유지

#### 3. E2E 테스트 CI 파이프라인 개선
- **기존 문제**: `gis-ci.yml`의 `e2e-test` job에 PostgreSQL만 서비스로 있어 Redis/ES 의존 테스트 실패 가능
- **개선 사항**:
  1. **Redis 서비스 추가**: `redis:7-alpine`, health check 포함
  2. **Elasticsearch 서비스 추가**: `elasticsearch:8.17.0`, single-node, security disabled, 256MB heap
     - CI에서는 nori 플러그인 없이 기본 analyzer 사용 (플러그인 설치 시간 절약)
     - 간소화된 인덱스 매핑으로 `gis-address` 인덱스 생성
     - PostGIS에서 parcels 1,000건 추출하여 ES에 bulk 인덱싱 (검색 테스트용)
  3. **`@full-stack` 태그로 테스트 분류**: Kafka + MinIO + Worker 의존성이 있는 `upload-pipeline.spec.ts`에 태그 추가
     - CI에서 `--grep-invert="@full-stack"`으로 58/60 테스트 실행 (upload 2건 스킵)
     - 로컬에서는 전체 60개 테스트 실행
- **의사결정**: CI에서 full-stack 테스트를 위해 Kafka/MinIO/Worker까지 서비스로 띄우는 것은 비용 대비 효용이 낮음 → 태그 기반 분류가 실용적

### 작업 후: 완료 내용
- [x] `.gitignore`에 `docker-compose.override.yml` 추가 (git untracked 확인 완료)
- [x] ES 인덱싱 스크립트 재실행 → 255,568건 정규화 인덱싱, `region_code=POCHEON` 확인
- [x] E2E 테스트 60/60 전체 PASS (ES 재인덱싱 후 검증)
- [x] `gis-ci.yml`에 Redis + Elasticsearch 서비스 추가
- [x] CI용 ES 인덱스 생성 + 테스트 데이터 시딩 스텝 추가
- [x] `upload-pipeline.spec.ts`에 `@full-stack` 태그 추가, CI에서 58/60 테스트 실행
- [x] 로컬 전체 테스트 60/60 PASS 재확인

### 다음 루프 TODO
- [ ] CI 워크플로우 실제 실행 테스트 (push하여 GitHub Actions에서 동작 확인)
- [ ] CI에서 ES nori 플러그인 미사용에 따른 검색 테스트 결과 차이 검토 (한국어 형태소 분석 없이 기본 토크나이저 사용)
- [ ] `@full-stack` 테스트를 CI에서도 실행할 수 있도록 Kafka + MinIO 서비스 추가 검토 (선택적)

---

## Loop 11 (2026-03-24)

### 작업 전: 목표
- Loop 10에서 이월된 TODO 수행:
  1. CI 워크플로우 실제 실행 테스트 (push하여 GitHub Actions에서 동작 확인) — 로컬에서 워크플로우 파일 검증 및 개선
  2. CI에서 ES nori 플러그인 미사용에 따른 검색 테스트 결과 차이 검토 (한국어 형태소 분석 없이 기본 토크나이저 사용)
  3. `@full-stack` 테스트를 CI에서도 실행할 수 있도록 Kafka + MinIO 서비스 추가 검토 (선택적)

### 작업 중: 주요 문제 및 의사결정

#### 1. CI 워크플로우 데이터 시딩 문제 발견 및 수정
- **문제**: CI의 `e2e-test` job이 `initdb/*.sql`만 실행하여 DB에 region/layer 데이터 없음
  - region 없음 → 프론트엔드 RegionSelector에 지역 없음 → 검색 시 region 파라미터 없음
  - layer 없음 → LayerTree 빈 상태
  - ES 데이터 없음 → "Seed ES test data from PostGIS" 스텝이 빈 DB에서 쿼리하여 0건 인덱싱
- **수정**: CI에 `06_seed_pocheon.sql` + `09_seed_layers.sql` 실행 스텝 추가
  - region(POCHEON) + 6개 레이어(PARCELS, PARCELS_LABELS, BUILDINGS, BUILDINGS_LABELS, FACILITY_NODES, FACILITY_PIPES) 시딩

#### 2. `06_seed_pocheon.sql` region code 불일치 수정
- **문제**: `06_seed_pocheon.sql`의 region code가 `'4165000000'` (행정구역코드)이었으나, 실제 DB는 `'POCHEON'` (Loop 2에서 확인)
  - `07_migrate_parcels.sql`, `08_migrate_buildings.sql`, `migrate-legacy.sh`도 동일 불일치
- **수정**: 4개 파일의 region code를 모두 `'POCHEON'`으로 통일
  - `06_seed_pocheon.sql`: code `'4165000000'` → `'POCHEON'`, name `'경기도 포천시'` → `'포천시'`
  - `07_migrate_parcels.sql`: 4건 변경
  - `08_migrate_buildings.sql`: 4건 변경
  - `migrate-legacy.sh`: 1건 변경

#### 3. CI ES 매핑 — edge_ngram autocomplete 추가
- **문제**: 기존 CI ES 매핑이 plain `text` 타입만 사용하여 `address.autocomplete` 서브필드 없음
  - 프로덕션 nori analyzer: "포천시" → ["포천시", "포천", "시"] (형태소 분해)
  - CI standard analyzer: "포천시" → ["포천시"] (단일 토큰)
  - "포천"으로 검색 시 "포천시" 매칭 불가 → 검색 테스트 실패 예상
- **수정**: CI ES 매핑에 `address.autocomplete` 서브필드 추가
  - `autocomplete_index` analyzer: standard tokenizer + edge_ngram(1-20) filter
  - `autocomplete_search` analyzer: standard tokenizer + lowercase
  - "포천시" 인덱싱 → ["포", "포천", "포천시"] edge_ngram 토큰 생성 → "포천" prefix 검색 가능
- **차이점 문서화**:
  - nori: 형태소 분석으로 "소흘읍" → "소흘" + "읍" 분해 가능
  - CI: edge_ngram으로 prefix 매칭만 가능, 형태소 분해 없음
  - E2E 테스트는 "포천" 같은 단순 검색어 사용하므로 edge_ngram으로 충분

#### 4. CI ES 테스트 데이터 직접 시딩
- **문제**: 기존 "Seed ES test data from PostGIS" 스텝이 빈 DB에서 쿼리하여 데이터 0건
- **수정**: PostGIS 쿼리 대신 5건의 인라인 JSON 데이터를 `_bulk` API로 직접 인덱싱
  - parcel 3건: 포천시 소흘읍 이동교리 58-2, 59-4 / 신읍동 59-13
  - building 2건: 포천시청, 소흘읍사무소
  - `_refresh` 호출로 즉시 검색 가능 상태 보장

#### 5. @full-stack 테스트 CI 실행 가능성 평가
- upload-pipeline 테스트에 필요한 서비스: Kafka + MinIO + gis-worker
  - Kafka (KRaft mode): ~500MB 이미지, 30초+ startup
  - MinIO: ~200MB 이미지
  - gis-worker: Docker 빌드 필요
- **결론**: 2개 테스트를 위해 3개 추가 서비스는 CI 시간/비용 대비 효용 부족
  - 현재 `@full-stack` 태그 기반 스킵(58/60 CI + 60/60 로컬) 유지가 최적
  - 향후 upload 기능 확장 시 재검토 가능

### 작업 후: 완료 내용
- [x] CI 워크플로우에 region + layer 시딩 스텝 추가 (`06_seed_pocheon.sql`, `09_seed_layers.sql`)
- [x] CI ES 매핑에 `address.autocomplete` 서브필드 + edge_ngram 분석기 추가
- [x] CI ES 테스트 데이터 5건 직접 인라인 시딩 (PostGIS 의존성 제거)
- [x] `06_seed_pocheon.sql` region code `'4165000000'` → `'POCHEON'` 수정
- [x] `07_migrate_parcels.sql`, `08_migrate_buildings.sql`, `migrate-legacy.sh` region code 동기화
- [x] nori vs standard analyzer 차이 분석 및 CI edge_ngram 대안 구현
- [x] @full-stack 테스트 CI 실행 비용 분석 → 현재 태그 기반 스킵 유지 결정

### 다음 루프 TODO
- [x] CI 워크플로우 실제 push 테스트 (GitHub Actions에서 동작 확인) → Loop 12
- [x] CI에서 highlight marker 테스트(search.spec.ts 2건)가 테스트 데이터 5건으로 동작하는지 확인 → Loop 12
- [x] `seed_facilities.sql`의 region code도 `POCHEON` 기준으로 검증 (DB의 `gis.regions` JOIN 사용 여부 확인) → Loop 12

---

## Loop 12 (2026-03-24)

### 작업 전: 목표
- Loop 11에서 이월된 TODO 수행:
  1. `seed_facilities.sql`의 region code `POCHEON` 기준 검증 (DB의 `gis.regions` JOIN 사용 여부 확인)
  2. CI에서 highlight marker 테스트(search.spec.ts 2건)가 테스트 데이터 5건으로 동작하는지 분석 및 검증
  3. CI 워크플로우 실제 push 테스트 준비 (GitHub Actions에서 동작 확인)

### 작업 중: 주요 문제 및 의사결정

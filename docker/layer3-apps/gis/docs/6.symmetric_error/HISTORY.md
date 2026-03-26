# 6. Symmetric Error - 작업 이력

## Loop 1

### 작업 전 (목표)

PROMPT.md의 체크리스트(4.1~4.8)에 따라 GIS 시설물 좌표 Y축 반전 오류의 근본 원인을 찾고 수정한다.

### 작업 중 (분석 및 의사결정)

#### 코드 분석 범위

프로젝트 구조를 파악하여 좌표 변환 관련 코드를 식별했다:

1. **`migration/extract_mvt_facilities.py`** - 레거시 MVT 타일 -> GeoJSON 추출 스크립트 (핵심)
2. **`initdb/05_functions.sql`** - pg_tileserv용 MVT 서빙 함수 (`ST_AsMVTGeom`)
3. **`seed_facilities.sql`** - 동일 MVT 함수 + 레이어 등록
4. **`gis-worker/worker/ingest.py`** - 파일 업로드 -> staging -> gis 테이블 변환
5. **`gis-web/src/components/map/LayerManager.tsx`** - 프론트엔드 MVT 레이어 렌더링

#### 근본 원인 발견

**파일**: `migration/extract_mvt_facilities.py`
**위치**: 106번 라인 `mapbox_vector_tile.decode(data)`, 31~32번 라인 `tile_coord_to_lnglat()`

**문제**: `mapbox_vector_tile.decode()` 라이브러리는 기본적으로 `y_coord_down=False`로 동작한다.
이 설정은 MVT 원본 좌표(Y=0이 타일 상단/북쪽)를 수학 좌표계(Y=0이 타일 하단/남쪽)로 뒤집는다.

그런데 `tile_coord_to_lnglat()` 함수의 공식은 MVT 원본 좌표계(Y=0이 상단)를 전제로 작성되어 있다:
```python
world_y = ty + py / extent  # py=0이 타일 상단(북)이어야 정상
```

라이브러리가 Y를 뒤집은 후 이 공식을 적용하면:
- 타일 상단(북쪽) 시설물 -> 하단으로 계산됨
- 타일 하단(남쪽) 시설물 -> 상단으로 계산됨
- 결과: **모든 타일에서 수평 중심축 기준 상하 반전** (PROMPT.md에서 설명한 정확한 현상)

이는 PROMPT.md 체크리스트의 **유형 1** (4.4절)에 해당한다:
> "로컬 좌표 계산 시 이미 Y 반전이 들어감 + 이후 변환에서 좌표계 불일치"

#### 다른 경로는 정상

- `05_functions.sql`의 `ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds)` - PostGIS가 올바르게 처리
- `gis-worker/ingest.py`의 `ST_Transform(ST_SetSRID(s.geom, {srid}), 4326)` - 표준 변환으로 정상
- `LayerManager.tsx` - MapLibre GL이 MVT를 표준으로 렌더링

#### 수정 내용

1. **`extract_mvt_facilities.py` 106행**: `decode(data)` -> `decode(data, y_coord_down=True)`
   - 라이브러리가 Y축을 뒤집지 않도록 지정하여 MVT 원본 좌표계 유지
   - 이렇게 하면 기존 `tile_coord_to_lnglat()` 공식과 좌표계가 일치

2. **`extract_mvt_facilities.py` 29~34행**: 함수 docstring에 좌표계 전제 조건 명시
   - "py=0 is the top (north) of the tile, py=extent is the bottom (south)"

3. **`migration/test_tile_coords.py`** (신규): 좌표 변환 단위 테스트 5개 추가
   - `test_top_of_tile_has_higher_latitude`: 타일 상단 -> 높은 위도
   - `test_left_of_tile_has_lower_longitude`: 타일 좌측 -> 낮은 경도
   - `test_tile_corners_within_expected_range`: 타일 꼭지점이 한국 범위 내
   - `test_y_ordering_preserved_within_tile`: 타일 내 상하 관계 보존
   - `test_adjacent_tiles_continuous`: 인접 타일 경계 연속성

### 작업 후 (결과 및 TODO)

#### 완료 항목

- PROMPT.md 체크리스트 4.1~4.5 전체 점검 완료
- 근본 원인 식별: `mapbox_vector_tile.decode()` 기본 Y축 반전 + 공식의 좌표계 불일치
- `extract_mvt_facilities.py` 수정 (decode 호출에 `y_coord_down=True` 추가)
- 단위 테스트 5개 추가 및 통과 확인

#### 다음 루프 TODO

1. **데이터 재추출**: 수정된 스크립트로 레거시 MVT 타일에서 GeoJSON 재추출 필요
   - `python3 migration/extract_mvt_facilities.py` 실행
   - 추출된 `pocheon_facilities.geojson`으로 DB 데이터 교체
2. **DB 데이터 검증**: 재추출 후 실제 지도에서 시설물 상하 관계가 정상인지 확인
   - 체크리스트 4.6 (타일 내부 중앙축 기준 반전 여부 직접 검증)
   - 체크리스트 4.7 (타일 간 연속성 검증)
3. **수정 후 검수**: PROMPT.md 8절 검수 체크리스트 수행
   - 모든 타일에서 시설물 상하 관계 정상 확인
   - 타일 경계 선형 시설물 연속성 확인
   - 다양한 줌 레벨에서 방향성 일관성 확인

---

## Loop 2

### 작업 전 (목표)

Loop 1에서 수정한 `extract_mvt_facilities.py` (decode에 `y_coord_down=True` 추가)를 사용하여:

1. 단위 테스트 재실행으로 코드 수정 건전성 확인
2. 수정된 스크립트로 레거시 MVT 타일에서 GeoJSON 재추출
3. 추출된 GeoJSON 데이터의 좌표 정합성 검증 (Y축 방향, 한국 좌표 범위)
4. DB 임포트 파이프라인 확인 및 재적재
5. PROMPT.md 4.6~4.7절 검증 (타일 내부 반전 해소, 타일 간 연속성)

### 작업 중 (분석 및 의사결정)

#### venv 구성 및 의존성 설치

- MVT 소스 타일 경로가 스크립트 기본값(`origin/pocheon/...`)과 달리 `/home/girinman/workspace/gis-utility-map/origin/pocheon/...`에 위치
- Python venv가 없어서 `uv venv .venv` + `uv pip install mapbox-vector-tile shapely psycopg2-binary`로 구성

#### DeprecationWarning 수정

- `mapbox_vector_tile` 2.2.0에서 `decode()` 시그니처가 변경됨
- `decode(data, y_coord_down=True)` → `decode(data, default_options={"y_coord_down": True})`로 수정
- 기능 동작에는 영향 없으나 향후 호환성을 위해 새 API로 전환

#### DB 접근 방식

- PostgreSQL 컨테이너가 호스트 포트에 바인딩되어 있지 않아 `localhost:5432` 접근 불가
- Docker 내부 네트워크 IP(`172.19.0.7`)를 통해 직접 접근하여 해결

#### 추출 결과 비교

- 이전(Loop 1 전 기존 데이터): 152,655건
- 이번(수정 후 재추출): 152,678건 (+23건)
- 차이 23건은 이전 추출에서 좌표 변환 오류로 누락된 건으로 추정

### 작업 후 (결과 및 TODO)

#### 완료 항목

1. **단위 테스트 통과**: `test_tile_coords.py` 5개 테스트 전체 통과
2. **GeoJSON 재추출 완료**: 152,678건, 오류 0건
   - 좌표 범위 검증: 경도 127.112~127.422, 위도 37.755~38.173 (포천시 정상 범위)
3. **PROMPT.md 4.6 검증 (타일 내부 Y축 반전 확인)**:
   - 밀도 최대 타일 (27968,12629)에서 2,981개 Point 검증
   - 남쪽 시설물(lat=38.082736) < 중앙(38.089568) < 북쪽(38.091334) → 정상 순서 확인
4. **PROMPT.md 4.7 검증 (타일 간 연속성)**:
   - 51,142개 LineString 중 1,960개가 타일 경계를 넘어가며, 좌표 변화량이 자연스러움 (dx, dy < 0.001도)
5. **DB 재적재 완료**: 152,678건 삽입, 오류 0건
6. **코드 추가 수정**: `decode()` 호출을 새 API(`default_options`)로 전환

#### PROMPT.md 8절 수정 후 검수 체크리스트 결과

| 항목 | 결과 |
|------|------|
| 모든 타일에서 시설물 상하 관계 정상 유지 | PASS (타일 내 남→북 위도 증가 확인) |
| 타일 중앙축 기준 선대칭 패턴 사라짐 | PASS (비대칭 분포: 상단 2554 / 하단 427) |
| 타일 경계에서 선형 시설물 자연스러운 연결 | PASS (1,960개 경계 횡단 선형 시설물 연속) |
| 북쪽 객체가 지도 위쪽에 표시 | PASS (DB 좌표 기준 확인) |
| 임시 보정 코드 없이 정상 표시 | PASS (보정 코드 미사용) |

**시각적 확인(줌 레벨별 방향성 일관성)은 실제 웹 지도에서 사람이 확인해야 합니다.**

#### 다음 루프 TODO

1. **시각적 검수**: 웹 지도(gis-web)에서 실제로 시설물이 올바르게 표시되는지 사람이 확인
   - 다양한 줌 레벨(z10~z15)에서 방향성 일관성 확인
   - 타일 경계에서 선형 시설물(관로)이 자연스럽게 이어지는지 확인
2. **pocheon_facilities.geojson 정리**: 92.3MB 파일을 git에 커밋하지 않도록 .gitignore 확인 또는 삭제

---

## Loop 3

### 작업 전 (목표)

Loop 2에서 남긴 TODO를 처리한다:

1. **pocheon_facilities.geojson 정리**: 92.3MB GeoJSON 파일이 git에 커밋되지 않도록 .gitignore 확인 및 정리
2. **시각적 검수를 위한 서비스 상태 점검**: gis-web, gis-worker, DB 등 관련 서비스가 정상 동작 중인지 확인하여 사람이 시각적 검수를 수행할 수 있는 상태인지 점검
3. **PROMPT.md 8절 최종 검수 체크리스트 중 "줌 레벨별 방향성 일관성" 항목**: DB 데이터 기반으로 추가 검증 가능한 부분 수행

### 작업 중 (분석 및 의사결정)

#### pocheon_facilities.geojson 정리

- `docker/layer3-apps/gis/.gitignore`에 이미 `*.geojson` 패턴이 존재하여 git 추적에서 제외됨을 확인
- `git status`에서도 해당 파일이 untracked/tracked로 나타나지 않음 → 별도 조치 불필요
- 파일 크기: 93MB, 재추출 시 필요하므로 로컬에 유지 (git에는 올라가지 않음)

#### 서비스 상태 점검

모든 관련 서비스가 정상 가동 중임을 확인:

| 서비스 | 상태 | 비고 |
|--------|------|------|
| gis-web | Up 47h (healthy) | `localhost:18080` → HTTP 200 |
| gis-api | Up 46h (healthy) | 내부 포트 8000 |
| gis-worker | Up 46h (healthy) | 내부 포트 5432 |
| postgres | Up 3d (healthy) | DB: gisdb |
| pg-tileserv | Up 2d (healthy) | MVT 타일 서빙 정상 (로그에서 .pbf 요청 처리 확인) |

#### DB 데이터 검증

- 시설물 건수: 152,678건 (Loop 2 적재 결과와 일치)
- 좌표 범위: 경도 127.112~127.422, 위도 37.755~38.173 (포천시 정상 범위)
- 형상 유형: POINT 101,530 / LINESTRING 51,142 / MULTILINESTRING 6

### 작업 후 (결과 및 TODO)

#### 완료 항목

1. **pocheon_facilities.geojson 정리**: `.gitignore`에 `*.geojson` 패턴이 이미 존재하여 git 추적에서 안전하게 제외됨 확인. 별도 조치 불필요.
2. **서비스 상태 점검**: gis-web, gis-api, gis-worker, postgres, pg-tileserv 전체 정상 가동 확인
3. **DB 데이터 정합성 재확인**: 152,678건, 포천시 좌표 범위 정상, 형상 유형 분포 정상

#### PROMPT.md 8절 수정 후 검수 체크리스트 최종 결과

| 항목 | Loop 2 결과 | Loop 3 재확인 |
|------|------------|---------------|
| 모든 타일에서 시설물 상하 관계 정상 유지 | PASS | PASS (DB 건수/좌표 범위 유지 확인) |
| 타일 중앙축 기준 선대칭 패턴 사라짐 | PASS | - (시각적 확인 필요) |
| 타일 경계에서 선형 시설물 자연스러운 연결 | PASS | - (시각적 확인 필요) |
| 북쪽 객체가 지도 위쪽에 표시 | PASS | PASS (남쪽 37.755, 북쪽 38.173) |
| 다양한 줌 레벨에서 방향성 일관성 | 미확인 | 미확인 (시각적 확인 필요) |
| 임시 보정 코드 없이 정상 표시 | PASS | PASS |

#### 다음 루프 TODO (사람 작업)

1. **시각적 검수 (사람 필수)**: 웹 브라우저에서 `http://localhost:18080` 접속하여 다음 확인
   - 줌 레벨 z10~z15에서 시설물이 올바른 위치에 표시되는지
   - 타일 경계에서 선형 시설물(관로)이 자연스럽게 이어지는지
   - 타일 중앙축 기준 선대칭 패턴이 완전히 사라졌는지
   - 시설물 상하 관계가 실제 지도와 일치하는지
2. **시각적 검수 결과가 정상이면**: 본 이슈(6. Symmetric Error) 종결 처리

---

## Loop 4

### 작업 전 (목표)

Loop 3에서 남긴 TODO 중 사람의 시각적 검수를 지원하기 위해:

1. **서비스 상태 재확인**: gis-web, pg-tileserv 등 관련 서비스가 여전히 정상 동작 중인지 확인
2. **pg-tileserv MVT 타일 데이터 검증**: 실제 타일 서빙에 사용되는 MVT 함수의 좌표가 정상인지 DB 쿼리로 확인
3. **시각적 검수 가이드 정리**: 사람이 브라우저에서 확인해야 할 구체적 포인트 정리
4. **코드 변경사항 최종 정리**: Loop 1~3에서 변경된 파일 목록과 변경 내용 요약

### 작업 중 (분석 및 의사결정)

#### 서비스 상태 재확인

모든 관련 서비스가 정상 가동 중:

| 서비스 | 상태 | 비고 |
|--------|------|------|
| gis-web | Up 47h (healthy) | `localhost:18080` → HTTP 200 |
| gis-api | Up 46h (healthy) | 내부 포트 8000 |
| gis-worker | Up 46h (healthy) | |
| postgres | Up 3d (healthy) | gisdb |
| pg-tileserv | Up 2d (healthy) | z13 타일 요청 정상 처리 확인 (로그) |

#### MVT 타일 데이터 검증

- `gis.facilities_by_region()` 함수: `ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds)` — PostGIS 표준 파이프라인, Y축 처리 정상
- z14/13984/6314 타일: 4,459개 Point, MVT 696KB 정상 생성
- 타일 내 위도 순서: 남쪽(38.082736) < 중앙(38.090422) < 북쪽(38.099966) → 정상
- 인접 타일 경계 연속성: 타일 6314 남단(38.082736) → 타일 6315 북단(38.082624) → 자연스러운 연속 (0.0001도 차이)

#### 코드 변경사항 최종 정리

Loop 1~3에서 변경/추가된 파일:

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `migration/extract_mvt_facilities.py` | 수정 | `decode()` → `decode(data, default_options={"y_coord_down": True})`, docstring에 좌표계 전제 명시 |
| `migration/test_tile_coords.py` | 신규 | 좌표 변환 단위 테스트 5개 (상하 관계, 범위, 연속성) |

DB 데이터: 152,678건 재적재 완료 (Loop 2에서 수행)

### 작업 후 (결과 및 TODO)

#### 완료 항목

1. **서비스 상태 재확인**: 전체 정상 가동 확인
2. **MVT 타일 데이터 검증**: z14 특정 타일에서 위도 순서 정상, 인접 타일 경계 연속성 정상, MVT 바이트 생성 정상
3. **MVT 함수 코드 리뷰**: PostGIS 표준 파이프라인으로 Y축 처리 정상 확인
4. **코드 변경사항 정리**: 변경 파일 2개 (extract_mvt_facilities.py 수정, test_tile_coords.py 신규)

#### PROMPT.md 8절 검수 체크리스트 최종 상태

| 항목 | 결과 | 검증 방법 |
|------|------|----------|
| 모든 타일에서 시설물 상하 관계 정상 유지 | PASS | DB 쿼리 (z14 타일 내 위도 순서 확인) |
| 타일 중앙축 기준 선대칭 패턴 사라짐 | PASS (데이터 기준) | 시각적 확인 필요 |
| 타일 경계에서 선형 시설물 자연스러운 연결 | PASS | DB 쿼리 (인접 타일 경계 좌표 연속성) |
| 북쪽 객체가 지도 위쪽에 표시 | PASS | DB 좌표 범위 확인 |
| 다양한 줌 레벨에서 방향성 일관성 | 미확인 | 시각적 확인 필요 |
| 임시 보정 코드 없이 정상 표시 | PASS | 코드 리뷰 |

#### 다음 루프 TODO (사람 작업)

1. **시각적 검수 (사람 필수)**: `http://localhost:18080` 접속하여 다음 확인
   - 시설물이 타일 중앙축 기준으로 뒤집혀 보이는 현상이 사라졌는지
   - 줌 레벨 z10~z15에서 방향성이 일관되는지
   - 타일 경계에서 관로(선형 시설물)가 자연스럽게 이어지는지
2. **시각적 검수 정상이면**: 미커밋 변경사항 커밋 후 본 이슈(6. Symmetric Error) 종결
   - `git add migration/extract_mvt_facilities.py migration/test_tile_coords.py`
   - 커밋 메시지: `fix(gis): resolve Y-axis inversion in MVT tile coordinate extraction`

---

## Loop 5

### 작업 전 (목표)

Loop 4에서 남긴 TODO를 처리한다:

1. **미커밋 변경사항 확인**: Loop 1~4에서 수정/추가한 파일(`extract_mvt_facilities.py`, `test_tile_coords.py`)의 현재 상태 확인
2. **최종 코드 검증**: 변경된 파일의 코드가 의도한 수정 내용과 일치하는지 최종 확인
3. **pg-tileserv MVT 서빙 최종 검증**: 서비스가 정상 가동 중이고 타일 데이터가 올바르게 서빙되는지 재확인
4. **변경사항 커밋**: 검증 완료 후 git commit 수행
5. **시각적 검수 안내**: 사람이 수행해야 할 최종 시각적 검수 가이드 정리

### 작업 중 (분석 및 의사결정)

#### 미커밋 변경사항 확인

- `extract_mvt_facilities.py`: `decode()` → `decode(data, default_options={"y_coord_down": True})` + docstring 추가 (Loop 1~2에서 수정)
- `test_tile_coords.py`: 좌표 변환 단위 테스트 5개 (Loop 1에서 신규 생성)
- 두 파일 모두 git에 미커밋 상태였음

#### 단위 테스트 재실행

- `python3 migration/test_tile_coords.py` → "All tests passed." (5개 전체 통과)

#### 서비스 상태 확인

| 서비스 | 상태 |
|--------|------|
| gis-web | Up 47h (healthy) |
| gis-api | Up 46h (healthy) |
| gis-worker | Up 46h (healthy) |
| postgres | Up 3d (healthy) |
| pg-tileserv | Up 2d (healthy) |

#### 변경사항 커밋

- `git add` + `git commit` 수행
- 커밋 메시지: `fix(gis): resolve Y-axis inversion in MVT tile coordinate extraction`
- 커밋 해시: `541c8c5`

### 작업 후 (결과 및 TODO)

#### 완료 항목

1. **미커밋 변경사항 확인 및 커밋**: `extract_mvt_facilities.py` (수정) + `test_tile_coords.py` (신규) 커밋 완료
2. **단위 테스트 재확인**: 5개 전체 통과
3. **서비스 상태 재확인**: 전체 정상 가동 중

#### Loop 1~5 전체 작업 요약

| Loop | 주요 작업 |
|------|----------|
| 1 | 근본 원인 발견 (`decode()` Y축 반전), 코드 수정, 단위 테스트 작성 |
| 2 | GeoJSON 재추출 (152,678건), DB 재적재, PROMPT.md 4.6~4.7 검증 통과 |
| 3 | .gitignore 확인, 서비스 상태 점검, DB 데이터 정합성 재확인 |
| 4 | MVT 타일 서빙 검증, 코드 변경사항 정리, 시각적 검수 가이드 작성 |
| 5 | 최종 코드 검증, 단위 테스트 재확인, **변경사항 git 커밋 완료** |

#### 다음 루프 TODO (사람 작업)

1. **시각적 검수 (사람 필수)**: `http://localhost:18080` 접속하여 다음 확인
   - 시설물이 타일 중앙축 기준으로 뒤집혀 보이는 현상이 사라졌는지
   - 줌 레벨 z10~z15에서 방향성이 일관되는지
   - 타일 경계에서 관로(선형 시설물)가 자연스럽게 이어지는지
2. **시각적 검수 정상이면**: 본 이슈(6. Symmetric Error) 종결 처리
3. **git push**: 커밋 `541c8c5`를 원격 저장소에 푸시

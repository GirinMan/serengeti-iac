# GIS 앱 운영 가이드

이 문서는 GIS 지하시설물 관리 시스템의 일상 운영 절차를 다룹니다.
초기 배포 절차는 `README.md`를 참고하세요.

## 1. 새 지역 데이터 임포트

### 1.1 Shapefile 데이터 (권장: API 업로드)

```bash
# 1. JWT 토큰 획득
TOKEN=$(curl -s -X POST https://gis.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"..."}' | jq -r .access_token)

# 2. Shapefile ZIP 업로드
curl -X POST "https://gis.example.com/api/v1/import/upload?region_code=POCHEON&target_table=parcels" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@parcels.zip"

# 3. 수집 상태 확인
curl -s "https://gis.example.com/api/v1/import/status/{import_id}" \
  -H "Authorization: Bearer $TOKEN" | jq
```

지원 포맷: `.shp` `.geojson` `.json` `.zip` `.gpkg` `.csv` (최대 500MB)

수집 파이프라인: API → MinIO 업로드 → Kafka 메시지 발행 → gis-worker 처리 → staging 스키마 → gis 스키마 (자동 좌표 변환)

### 1.2 Shapefile 데이터 (수동 SQL 마이그레이션)

```bash
# 1. 호스트에서 Shapefile을 컨테이너 내부로 복사
docker cp ./data.shp postgres:/tmp/data.shp
docker cp ./data.shx postgres:/tmp/data.shx
docker cp ./data.dbf postgres:/tmp/data.dbf
docker cp ./data.prj postgres:/tmp/data.prj

# 2. 컨테이너 내부에서 shp2pgsql + psql 파이프라인 실행
#    -s 5181: 원본 좌표계(Korea 2000 / Modified Central)
#    -W CP949: 한글 인코딩
#    -c: 테이블 생성 (기존 테이블 대체 시 -d)
docker exec postgres sh -c \
  "shp2pgsql -s 5181 -W CP949 -c /tmp/data.shp staging.parcels_raw | psql -U postgres -d gisdb -q"

# 3. 좌표 변환 + gis 스키마로 이동
docker exec postgres psql -U postgres -d gisdb -c "
  INSERT INTO gis.parcels (region_id, jibun, geom, properties)
  SELECT 1, pnu, ST_Transform(geom, 4326), row_to_json(t)::jsonb
  FROM staging.parcels_raw t;
"
```

### 1.3 지역 등록

새 지역을 추가하려면:

```sql
INSERT INTO gis.regions (code, name, bbox, center, default_zoom, properties)
VALUES (
  'NEW_REGION',
  '새 지역 이름',
  ST_MakeEnvelope(126.8, 37.4, 127.2, 37.8, 4326),  -- (xmin, ymin, xmax, ymax)
  ST_SetSRID(ST_MakePoint(127.0, 37.6), 4326),
  14,
  '{}'::jsonb
);
```

## 2. 레이어 추가/수정

### 2.1 새 레이어 등록

레이어는 **두 곳**에 동기화해야 합니다:
- `migration/09_seed_layers.sql` — 마이그레이션 시 실행
- `initdb/seed_facilities.sql` — Docker 초기화 시 실행

```sql
-- 레이어 INSERT (ON CONFLICT UPSERT 패턴)
INSERT INTO gis.layers (region_id, code, name, category, source_table, tile_url, min_zoom, max_zoom, visible, sort_order, style)
VALUES (
  1,                                    -- region_id (POCHEON = 1)
  'NEW_LAYER',                          -- 고유 코드
  '새 레이어',                          -- 표시 이름
  'FACILITY',                           -- 카테고리: BASE / FACILITY
  'new_layer',                          -- MVT 레이어명 (ST_AsMVT 2번째 인자)
  '/gis.new_layer_function/{z}/{x}/{y}.pbf',  -- pg_tileserv function URL
  13, 22,                               -- min/max zoom
  true,                                 -- 기본 표시 여부
  50,                                   -- 정렬 순서
  '{"type":"fill","fill-color":"#3498db","fill-opacity":0.3}'::jsonb
)
ON CONFLICT (region_id, code) DO UPDATE SET
  name = EXCLUDED.name, style = EXCLUDED.style, ...;
```

### 2.2 라벨 레이어 추가

라벨 레이어는 부모 레이어 코드에 `_LABELS` 접미어를 붙입니다:

```sql
-- PARCELS의 라벨 → PARCELS_LABELS
-- BUILDINGS의 라벨 → BUILDINGS_LABELS
```

`_LABELS` 컨벤션을 따르면 자동으로:
- LayerTree에서 부모 아래 들여쓰기 표시
- 부모 토글 시 연동 (부모 OFF → 라벨 OFF, 라벨 ON → 부모 자동 ON)
- Legend에서 제외

스타일 JSON 예시:
```json
{
  "type": "symbol",
  "text-field": ["get", "jibun"],
  "text-size": ["interpolate", ["linear"], ["zoom"], 16, 9, 18, 12, 20, 15],
  "text-anchor": "center",
  "text-allow-overlap": false,
  "text-color": "#4a3800",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.5,
  "text-padding": 2
}
```

### 2.3 레이어 스타일 변경 후 반영

```bash
# 1. DB 업데이트
docker exec -i postgres psql -U postgres -d gisdb -c "
  UPDATE gis.layers SET style = '{...}'::jsonb WHERE code = 'PARCELS';
"

# 2. Redis 캐시 클리어
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 DEL layers:POCHEON layers:all
```

## 3. Elasticsearch 인덱싱

### 3.1 전체 재인덱싱

```bash
bash docker/layer3-apps/gis/migration/10_setup_elasticsearch.sh
```

이 스크립트는:
1. nori 플러그인 설치 (최초 1회)
2. ES 재시작
3. `gis-address` 인덱스 삭제 + 재생성 (nori + edge_ngram 분석기)
4. PostGIS parcels/buildings 데이터를 bulk 인덱싱

### 3.2 검색 테스트

```bash
# ES 컨테이너 내부에서
docker exec elasticsearch curl -sf -u "elastic:$ELASTIC_PASSWORD" \
  'http://localhost:9200/gis-address/_search?q=address:포천'

# API를 통해 (한글은 URL 인코딩 필요: 포천 = %ED%8F%AC%EC%B2%9C)
curl 'http://localhost:18080/api/v1/search/address?q=%ED%8F%AC%EC%B2%9C&region=POCHEON'
```

### 3.3 인덱스 상태 확인

```bash
docker exec elasticsearch curl -sf -u "elastic:$ELASTIC_PASSWORD" \
  'http://localhost:9200/gis-address/_count'
```

## 4. Redis 캐시 관리

GIS API는 Redis DB 1에 레이어 메타데이터를 캐시합니다.

```bash
# 특정 지역 캐시 클리어
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 DEL layers:POCHEON

# 전체 캐시 클리어
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 DEL layers:all

# 캐시 키 목록 확인
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 KEYS 'layers:*'
```

캐시 TTL: 1시간 (자동 만료). DB 변경 후 즉시 반영이 필요하면 수동 클리어.

## 5. E2E 테스트

### 5.1 로컬 실행 (전체 60개)

```bash
cd docker/layer3-apps/gis/gis-web

# docker-compose.override.yml로 포트 18080 노출 필요
# (이미 .gitignore에 포함, 로컬에서만 사용)
npx playwright test
```

### 5.2 테스트 분류

| 태그 | 설명 | 개수 | CI 실행 |
|------|------|------|---------|
| (없음) | 일반 테스트 | 51 | O |
| `@full-stack` | Kafka+MinIO+Worker 의존 | 2 | X |
| `@nginx` | nginx 리버스 프록시 의존 | 7 | X |

### 5.3 특정 테스트만 실행

```bash
# 검색 테스트만
npx playwright test search

# @nginx 제외
npx playwright test --grep-invert="@nginx"
```

## 6. 트러블슈팅

### 타일이 로드되지 않음
```bash
# pg_tileserv 로그 확인
docker logs pg-tileserv --tail 20

# pg_tileserv function layer 목록 (Docker 네트워크 경유, 호스트 포트 미노출)
docker exec gis-web curl -sf http://pg-tileserv:7800/ | python3 -m json.tool

# 특정 타일 요청 테스트 (nginx 프록시 경유)
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:18080/tiles/gis.parcels_by_region/16/55924/25302.pbf"
# 또는 Docker 네트워크 내부에서 직접
docker exec gis-web curl -sf -o /dev/null -w "%{http_code}" \
  "http://pg-tileserv:7800/gis.parcels_by_region/16/55924/25302.pbf"
```

### 검색이 동작하지 않음
```bash
# ES 헬스 확인
docker exec elasticsearch curl -sf -u "elastic:$ELASTIC_PASSWORD" \
  'http://localhost:9200/_cluster/health'

# region_code 확인 (POCHEON이어야 함, 4165000000 아님)
docker exec elasticsearch curl -sf -u "elastic:$ELASTIC_PASSWORD" \
  'http://localhost:9200/gis-address/_search' \
  -H 'Content-Type: application/json' \
  -d '{"size":1,"_source":["region_code"]}'
```

### 레이어가 표시되지 않음
```bash
# DB 레이어 확인
docker exec postgres psql -U postgres -d gisdb -c \
  "SELECT code, visible, tile_url FROM gis.layers WHERE region_id = 1;"

# Redis 캐시 확인/클리어
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 GET layers:POCHEON
docker exec redis redis-cli -a "$REDIS_PASSWORD" -n 1 DEL layers:POCHEON layers:all
```

### gis-worker가 처리하지 않음
```bash
# 워커 로그 확인
docker logs gis-worker --tail 50

# Kafka 토픽 확인 (토픽명: gum.import.request)
docker exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic gum.import.request --from-beginning --max-messages 5
```

## 7. DB 접속 정보

| 항목 | 값 |
|------|-----|
| 컨테이너 | `postgres` |
| DB명 | `gisdb` |
| 사용자 | `postgres` |
| 스키마 | `gis` (데이터), `auth` (인증), `audit` (감사) |
| Redis | DB 1, 인증 필요 |
| Kafka 토픽 | `gum.import.request` |

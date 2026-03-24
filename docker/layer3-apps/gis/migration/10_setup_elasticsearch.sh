#!/usr/bin/env bash
# ============================================================
# Elasticsearch nori 플러그인 설치 + 주소 검색 인덱스 생성
# 실행: bash migration/10_setup_elasticsearch.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# .env 로드
if [ -f "$ROOT_DIR/.env" ]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

ES_USER="${ES_USER:-elastic}"
ES_PASS="${ELASTIC_PASSWORD:?ELASTIC_PASSWORD not set}"
ES_CONTAINER="${ES_CONTAINER:-elasticsearch}"

# Helper: run curl inside ES container
es_curl() {
    docker exec "$ES_CONTAINER" curl -sf -u "${ES_USER}:${ES_PASS}" "$@"
}

echo "=== [1/4] Elasticsearch nori 플러그인 설치 ==="
docker exec "$ES_CONTAINER" bash -c '
    if ! bin/elasticsearch-plugin list | grep -q analysis-nori; then
        bin/elasticsearch-plugin install analysis-nori --batch
        echo "nori plugin installed. Restart required."
    else
        echo "nori plugin already installed."
    fi
'

echo ""
echo "=== [2/4] Elasticsearch 재시작 (nori 플러그인 로드) ==="
docker restart "$ES_CONTAINER"
echo "Waiting for Elasticsearch to be ready..."
for i in $(seq 1 60); do
    if es_curl "http://localhost:9200/_cluster/health" > /dev/null 2>&1; then
        echo "Elasticsearch is ready."
        break
    fi
    sleep 2
done

echo ""
echo "=== [3/4] 주소 검색 인덱스 생성 ==="
# 기존 인덱스 삭제 (재실행 가능)
es_curl -X DELETE "http://localhost:9200/gis-address" > /dev/null 2>&1 || true

# nori 분석기 + 자동완성 설정
es_curl -X PUT "http://localhost:9200/gis-address" \
  -H 'Content-Type: application/json' \
  -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "tokenizer": {
        "nori_mixed": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed"
        }
      },
      "filter": {
        "edge_ngram_filter": {
          "type": "edge_ngram",
          "min_gram": 1,
          "max_gram": 20
        }
      },
      "analyzer": {
        "korean_index": {
          "type": "custom",
          "tokenizer": "nori_mixed",
          "filter": ["lowercase", "nori_readingform", "nori_part_of_speech"]
        },
        "korean_search": {
          "type": "custom",
          "tokenizer": "nori_mixed",
          "filter": ["lowercase", "nori_readingform"]
        },
        "autocomplete_index": {
          "type": "custom",
          "tokenizer": "nori_mixed",
          "filter": ["lowercase", "edge_ngram_filter"]
        },
        "autocomplete_search": {
          "type": "custom",
          "tokenizer": "nori_mixed",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "region_code":  { "type": "keyword" },
      "region_name":  { "type": "keyword" },
      "source_table": { "type": "keyword" },
      "source_id":    { "type": "long" },
      "address": {
        "type": "text",
        "analyzer": "korean_index",
        "search_analyzer": "korean_search",
        "fields": {
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_index",
            "search_analyzer": "autocomplete_search"
          }
        }
      },
      "emd":    { "type": "keyword" },
      "ri":     { "type": "keyword" },
      "jibun":  { "type": "text", "analyzer": "korean_index" },
      "bldnm": {
        "type": "text",
        "analyzer": "korean_index",
        "search_analyzer": "korean_search",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "location": { "type": "geo_point" }
    }
  }
}'
echo ""
echo "gis-address index created successfully."

echo ""
echo "=== [4/4] 인덱스 데이터 적재 (PostGIS → Elasticsearch) ==="

PGCONN="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${GIS_DB_NAME:-gisdb}"

# parcels 데이터 추출 + bulk 인덱싱
echo "Indexing parcels..."
docker exec postgres psql "${PGCONN}" -t -A -c "
SELECT jsonb_build_object(
    'index', jsonb_build_object('_index', 'gis-address', '_id', 'parcel_' || p.id)
)::text || chr(10) ||
jsonb_build_object(
    'region_code', r.code,
    'region_name', r.name,
    'source_table', 'gis.parcels',
    'source_id', p.id,
    'address', CONCAT_WS(' ', r.name, p.properties->>'emd', p.properties->>'ri', p.jibun),
    'emd', p.properties->>'emd',
    'ri', p.properties->>'ri',
    'jibun', p.jibun,
    'location', jsonb_build_object(
        'lat', ST_Y(ST_Centroid(p.geom)),
        'lon', ST_X(ST_Centroid(p.geom))
    )
)::text
FROM gis.parcels p
JOIN gis.regions r ON r.id = p.region_id
WHERE p.jibun IS NOT NULL
" | sed '/^$/d' > /tmp/parcels_bulk.ndjson

if [ -s /tmp/parcels_bulk.ndjson ]; then
    split -l 10000 /tmp/parcels_bulk.ndjson /tmp/parcels_chunk_
    for chunk in /tmp/parcels_chunk_*; do
        docker cp "$chunk" "${ES_CONTAINER}:/tmp/bulk_chunk.ndjson"
        es_curl -X POST "http://localhost:9200/_bulk" \
          -H 'Content-Type: application/x-ndjson' \
          --data-binary "@/tmp/bulk_chunk.ndjson" > /dev/null
        rm -f "$chunk"
    done
    docker exec "$ES_CONTAINER" rm -f /tmp/bulk_chunk.ndjson
    rm -f /tmp/parcels_bulk.ndjson
    echo "Parcels indexed."
else
    echo "No parcel data to index (run migration SQL first)."
fi

# buildings 데이터 추출 + bulk 인덱싱
echo "Indexing buildings..."
docker exec postgres psql "${PGCONN}" -t -A -c "
SELECT jsonb_build_object(
    'index', jsonb_build_object('_index', 'gis-address', '_id', 'building_' || b.id)
)::text || chr(10) ||
jsonb_build_object(
    'region_code', r.code,
    'region_name', r.name,
    'source_table', 'gis.buildings',
    'source_id', b.id,
    'address', b.address,
    'emd', b.properties->>'emd',
    'ri', b.properties->>'ri',
    'jibun', b.properties->>'jibun',
    'bldnm', b.bld_name,
    'location', jsonb_build_object(
        'lat', ST_Y(ST_Centroid(b.geom)),
        'lon', ST_X(ST_Centroid(b.geom))
    )
)::text
FROM gis.buildings b
JOIN gis.regions r ON r.id = b.region_id
WHERE b.bld_name IS NOT NULL
" | sed '/^$/d' > /tmp/buildings_bulk.ndjson

if [ -s /tmp/buildings_bulk.ndjson ]; then
    docker cp /tmp/buildings_bulk.ndjson "${ES_CONTAINER}:/tmp/buildings_bulk.ndjson"
    es_curl -X POST "http://localhost:9200/_bulk" \
      -H 'Content-Type: application/x-ndjson' \
      --data-binary "@/tmp/buildings_bulk.ndjson" > /dev/null
    docker exec "$ES_CONTAINER" rm -f /tmp/buildings_bulk.ndjson
    rm -f /tmp/buildings_bulk.ndjson
    echo "Buildings indexed."
else
    echo "No building data to index (run migration SQL first)."
fi

echo ""
echo "=== 완료 ==="
es_curl "http://localhost:9200/gis-address/_count" | python3 -m json.tool 2>/dev/null || \
es_curl "http://localhost:9200/gis-address/_count"
echo ""
echo "검색 테스트: docker exec ${ES_CONTAINER} curl -sf -u elastic:\$ELASTIC_PASSWORD 'http://localhost:9200/gis-address/_search?q=address:포천'"

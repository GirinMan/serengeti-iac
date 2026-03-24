#!/usr/bin/env bash
# GIS Utility Map - 종합 헬스체크 스크립트
# Usage: ./gis-status.sh [--host HOST] [--port PORT]

set +e

HOST="${1:-localhost}"
PORT="${2:-18080}"
BASE="http://${HOST}:${PORT}"
API_PORT="${3:-18000}"
API_BASE="http://${HOST}:${API_PORT}"

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  \033[32m✓\033[0m $1"; ((PASS++)); }
fail() { echo -e "  \033[31m✗\033[0m $1"; ((FAIL++)); }
warn() { echo -e "  \033[33m!\033[0m $1"; ((WARN++)); }

check_http() {
    local label="$1" url="$2" expect_status="${3:-200}"
    local status size
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    size=$(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "$url" 2>/dev/null || echo "0")

    if [ "$status" = "$expect_status" ]; then
        pass "$label (HTTP $status, ${size}B)"
    else
        fail "$label (HTTP $status, expected $expect_status)"
    fi
}

check_json_field() {
    local label="$1" url="$2" field="$3" expect="$4"
    local value
    value=$(curl -s --max-time 10 "$url" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$field'.split('.')
    for k in keys: d = d[k]
    print(d)
except: print('ERROR')
" 2>/dev/null || echo "ERROR")

    if [ "$value" = "$expect" ]; then
        pass "$label ($field=$value)"
    else
        fail "$label ($field=$value, expected $expect)"
    fi
}

# ─── 1. Docker 컨테이너 상태 ───
echo ""
echo "━━━ 1. Docker 컨테이너 상태 ━━━"
for container in gum-api gum-web gum-worker pg-tileserv pg-featureserv; do
    status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo "unknown")
    if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ] || [ "$health" = "no-healthcheck" ]; then
            pass "$container: $status ($health)"
        else
            warn "$container: $status ($health)"
        fi
    else
        fail "$container: $status"
    fi
done

# ─── 2. API 헬스체크 (상세) ───
echo ""
echo "━━━ 2. API 헬스체크 ━━━"
check_json_field "API 전체 상태" "${API_BASE}/api/health?detail=true" "status" "ok"

detail=$(curl -s --max-time 10 "${API_BASE}/api/health?detail=true" 2>/dev/null || echo "{}")
for svc in database redis elasticsearch; do
    val=$(echo "$detail" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('checks',{}).get('$svc','unknown'))
except: print('unknown')
" 2>/dev/null)
    if echo "$val" | grep -q "^ok"; then
        pass "  $svc: $val"
    else
        fail "  $svc: $val"
    fi
done

# ─── 3. 웹 프론트엔드 (nginx) ───
echo ""
echo "━━━ 3. 웹 프론트엔드 ━━━"
check_http "index.html" "${BASE}/"
check_http "SPA fallback" "${BASE}/nonexistent/path"

# ─── 4. API 엔드포인트 ───
echo ""
echo "━━━ 4. API 엔드포인트 ━━━"
check_http "GET /api/v1/regions/" "${BASE}/api/v1/regions/"

layers_count=$(curl -s --max-time 10 "${BASE}/api/v1/layers/" 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$layers_count" -gt 0 ]; then
    pass "GET /api/v1/layers/ (${layers_count} layers)"
else
    fail "GET /api/v1/layers/ (0 layers)"
fi

search_total=$(curl -s --max-time 10 "${BASE}/api/v1/search/address?q=%ED%8F%AC%EC%B2%9C" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
if [ "$search_total" -gt 0 ]; then
    pass "주소 검색 '포천' (${search_total} results)"
else
    fail "주소 검색 '포천' (0 results)"
fi

check_http "자동완성 '포천'" "${BASE}/api/v1/search/autocomplete?q=%ED%8F%AC%EC%B2%9C&size=8"

# ─── 5. 벡터 타일 서빙 ───
echo ""
echo "━━━ 5. 벡터 타일 서빙 ━━━"
tile_size=$(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "${BASE}/tiles/gis.parcels/14/13981/6324.pbf" 2>/dev/null || echo "0")
if [ "$tile_size" -gt 1000 ]; then
    pass "parcels 타일 z14 (${tile_size}B)"
else
    fail "parcels 타일 z14 (${tile_size}B, expected >1000)"
fi

tile_size2=$(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "${BASE}/tiles/gis.buildings/14/13981/6324.pbf" 2>/dev/null || echo "0")
if [ "$tile_size2" -gt 100 ]; then
    pass "buildings 타일 z14 (${tile_size2}B)"
else
    fail "buildings 타일 z14 (${tile_size2}B, expected >100)"
fi

# ─── 6. Feature 서버 ───
echo ""
echo "━━━ 6. Feature 서버 ━━━"
check_http "pg-featureserv index" "${BASE}/features/index.json"

# ─── 7. 타일 캐시 ───
echo ""
echo "━━━ 7. 타일 캐시 ━━━"
cache_status=$(curl -s -I --max-time 10 "${BASE}/tiles/gis.parcels/14/13981/6324.pbf" 2>/dev/null | grep -i "X-Cache-Status" | tr -d '\r\n' || echo "no header")
if echo "$cache_status" | grep -qi "HIT\|MISS\|EXPIRED"; then
    pass "nginx tile cache ($cache_status)"
else
    warn "nginx tile cache ($cache_status)"
fi

# ─── 결과 요약 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  \033[32m통과: ${PASS}\033[0m  \033[31m실패: ${FAIL}\033[0m  \033[33m경고: ${WARN}\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0

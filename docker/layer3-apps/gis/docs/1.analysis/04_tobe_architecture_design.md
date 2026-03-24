# Step 5: 현대적 아키텍처 전면 재설계 (Modernization Strategy)

## 1. AS-IS 분석 요약

### 현재 시스템의 근본적 한계

| 영역 | AS-IS 문제 | 영향 |
|------|-----------|------|
| **지역 확장성** | Extent/Center 6+ 곳 하드코딩, 서버 IP 4곳 하드코딩 | 새 지역 추가 시 11~18개 파일 수동 수정 |
| **데이터 확장성** | 타일 빌드 파이프라인 부재, dicLayers 수동 등록 | 새 데이터 추가가 수작업 의존 |
| **코드 품질** | JSP에 지도 렌더링+UI+비즈니스 로직 혼재, XSS 취약점 | 유지보수/테스트 불가 |
| **기술 스택** | Spring 4.3.9, Java 1.8, PostgreSQL 9.2, OpenLayers 5.3.0 | 보안 패치 종료, 성능 한계 |
| **인프라** | 단일 Windows 데스크탑, 수동 기동(배치파일+Eclipse) | 무중단 배포 불가, 스케일링 불가 |
| **타일 서빙** | Node.js Express + SQLite (단일 프로세스 읽기) | 동시 접속 한계, 캐싱 없음 |

### 핵심 개선 목표

1. **지역 독립(Region-agnostic)**: 하드코딩 제거, 동적 Bounding Box & Spatial Index
2. **데이터 자동화**: SHP/GeoJSON → PostGIS → 벡터 타일 자동 파이프라인
3. **관심사 분리**: 백엔드 API ↔ 프론트엔드 완전 분리
4. **인프라 재사용**: serengeti-iac의 PostgreSQL 16, Redis 7, Kafka 3.9, MinIO, Elasticsearch 8 활용

---

## 2. TO-BE 전체 시스템 아키텍처

### 2.1 시스템 구조도

```mermaid
graph TB
    subgraph Client["프론트엔드 (SPA)"]
        MAPLIBRE["MapLibre GL JS\n(벡터 타일 렌더링)"]
        REACT["React 19\n(UI 프레임워크)"]
        DECK["deck.gl\n(3D 시각화, 선택)"]
    end

    subgraph Proxy["리버스 프록시 (proxy-tier)"]
        NPM["Nginx Proxy Manager\n(SSL/라우팅)"]
    end

    subgraph API["백엔드 API (신규 컨테이너)"]
        FASTAPI["FastAPI\n(Python 3.12)"]
        TILER["pg_tileserv\n(동적 벡터 타일)"]
        FEATSERV["pg_featureserv\n(Feature API)"]
    end

    subgraph DataTier["데이터 계층 (data-tier, 기존 serengeti-iac)"]
        PG["PostgreSQL 16\n+ PostGIS 3.4"]
        REDIS["Redis 7\n(타일 캐시)"]
        ES["Elasticsearch 8\n(주소/건물 검색)"]
        MINIO["MinIO\n(원본 SHP/래스터 저장)"]
        KAFKA["Kafka 3.9\n(데이터 수집 이벤트)"]
    end

    subgraph Pipeline["데이터 파이프라인 (신규 컨테이너)"]
        INGEST["Ingest Worker\n(Python/GDAL)"]
        TILEBUILDER["Tile Builder\n(tippecanoe)"]
    end

    %% 클라이언트 → 프록시 → 서비스
    MAPLIBRE -->|"벡터 타일\n/api/tiles/{table}/{z}/{x}/{y}.pbf"| NPM
    REACT -->|"REST API\n/api/v1/*"| NPM
    DECK -->|"Feature 조회\n/api/features/*"| NPM

    NPM --> FASTAPI
    NPM --> TILER
    NPM --> FEATSERV
    NPM -->|"정적 SPA 서빙"| Client

    %% API → 데이터
    FASTAPI --> PG
    FASTAPI --> REDIS
    FASTAPI --> ES
    TILER --> PG
    FEATSERV --> PG

    %% 파이프라인
    INGEST -->|"원본 업로드"| MINIO
    INGEST -->|"공간 데이터 적재"| PG
    INGEST -->|"주소 색인"| ES
    KAFKA -->|"수집 이벤트 트리거"| INGEST
    TILEBUILDER -->|"사전 생성 타일"| MINIO
    TILEBUILDER -->|"소스 데이터"| PG

    style Client fill:#e3f2fd
    style Proxy fill:#fff3e0
    style API fill:#e8f5e9
    style DataTier fill:#fce4ec
    style Pipeline fill:#f3e5f5
```

### 2.2 기존 serengeti-iac 활용 매핑

| serengeti-iac 서비스 | TO-BE 역할 | 수정 필요 여부 |
|---------------------|-----------|--------------|
| **PostgreSQL 16** | 공간 DB (PostGIS 3.4 확장 추가) | Docker 이미지를 `postgis/postgis:16-3.4-alpine`으로 변경 |
| **Redis 7** | 타일 캐시 + 세션 저장 | 설정 변경 없음, 그대로 활용 |
| **Elasticsearch 8** | 주소/건물 전문 검색 + Geo 검색 | 인덱스 매핑 추가 |
| **MinIO** | 원본 데이터(SHP/GeoTIFF) 아카이브 + 사전 생성 타일 저장 | 버킷 생성만 필요 |
| **Kafka 3.9** | 데이터 수집 파이프라인 이벤트 버스 | 토픽 생성만 필요 |
| **Nginx Proxy Manager** | API/SPA 라우팅 + SSL 종단 | 프록시 호스트 추가 |
| Neo4j 5 | 현재 불필요 (향후 관로 네트워크 분석에 활용 가능) | — |
| RabbitMQ | 현재 불필요 (Kafka로 대체) | — |

### 2.3 신규 추가 컴포넌트 (serengeti-iac에 없는 것)

| 컴포넌트 | 이유 | Docker 이미지 |
|---------|------|--------------|
| **pg_tileserv** | PostGIS 테이블에서 직접 동적 MVT 생성. SQLite/정적 타일 제거 가능 | `pramsey/pg_tileserv:latest` |
| **pg_featureserv** | PostGIS Feature를 OGC API로 제공. MyBatis 대체 | `pramsey/pg_featureserv:latest` |
| **FastAPI 앱** | 비즈니스 로직 API (인증, 검색, 관리) | 커스텀 빌드 |
| **Ingest Worker** | GDAL/OGR 기반 데이터 수집 자동화 | 커스텀 빌드 (osgeo/gdal 기반) |
| **tippecanoe** | 대용량 데이터 → PMTiles 사전 빌드 | 커스텀 빌드 (felt/tippecanoe) |
| **프론트엔드 SPA** | React + MapLibre GL JS | nginx:alpine (정적 서빙) |

> pg_tileserv와 pg_featureserv는 PostGIS 전용 경량 서비스로, 기존의 Node.js 타일 서버 + Spring MVC 백엔드를 완전히 대체합니다. PostGIS에서 직접 MVT를 생성하므로 SQLite 타일 DB가 불필요해집니다.

---

## 3. 데이터 아키텍처

### 3.1 DB 스키마 개선 방향

#### AS-IS vs TO-BE 비교

```
AS-IS (PostgreSQL 9.2 + PostGIS 2.1)
├── ua502 (지번) - 포천시 전용, sgg 필터 없음
├── buildig_txt (건물) - 포천시 전용
├── tbl_user, tbl_auth (인증)
└── 좌표계: EPSG:5181 only

TO-BE (PostgreSQL 16 + PostGIS 3.4)
├── schema: gis
│   ├── regions (지역 관리)
│   ├── parcels (지번 - 다중 지역)
│   ├── buildings (건물 - 다중 지역)
│   ├── facilities (시설물 - 다중 지역/유형)
│   ├── facility_types (시설물 유형 코드)
│   └── layers (레이어 메타데이터)
├── schema: auth
│   ├── users
│   └── roles
├── schema: audit
│   └── data_imports (수집 이력)
└── 좌표계: EPSG:4326 (저장) + 동적 변환
```

#### TO-BE 핵심 테이블 DDL

```sql
-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 스키마 분리
CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================
-- 지역 관리 (동적 Bounding Box의 핵심)
-- ============================================================
CREATE TABLE gis.regions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10) UNIQUE NOT NULL,    -- 행정구역코드 (예: '41150' 포천시)
    name        VARCHAR(100) NOT NULL,          -- 지역명
    bbox        GEOMETRY(Polygon, 4326),        -- 지역 경계 폴리곤
    center      GEOMETRY(Point, 4326),          -- 지역 중심점
    zoom_min    SMALLINT DEFAULT 10,
    zoom_max    SMALLINT DEFAULT 19,
    srid_source INTEGER DEFAULT 5181,           -- 원본 좌표계
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regions_bbox ON gis.regions USING GIST (bbox);

-- ============================================================
-- 지번(필지) 데이터 - 다중 지역 지원
-- ============================================================
CREATE TABLE gis.parcels (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    pnu         VARCHAR(19),                    -- 필지고유번호
    jibun       VARCHAR(100),                   -- 지번 주소
    jimok       VARCHAR(10),                    -- 지목코드
    area_m2     NUMERIC(12,2),                  -- 면적
    geom        GEOMETRY(MultiPolygon, 4326) NOT NULL,
    properties  JSONB DEFAULT '{}',             -- 기타 속성 (유연한 확장)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parcels_geom ON gis.parcels USING GIST (geom);
CREATE INDEX idx_parcels_region ON gis.parcels (region_id);
CREATE INDEX idx_parcels_jibun ON gis.parcels USING GIN (to_tsvector('simple', jibun));

-- ============================================================
-- 건물 데이터 - 다중 지역 지원
-- ============================================================
CREATE TABLE gis.buildings (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    bld_name    VARCHAR(200),                   -- 건물명
    bld_use     VARCHAR(50),                    -- 건물용도
    address     VARCHAR(300),                   -- 도로명 주소
    floors      SMALLINT,                       -- 층수
    geom        GEOMETRY(Geometry, 4326) NOT NULL,  -- Point 또는 Polygon
    properties  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buildings_geom ON gis.buildings USING GIST (geom);
CREATE INDEX idx_buildings_region ON gis.buildings (region_id);
CREATE INDEX idx_buildings_name ON gis.buildings USING GIN (to_tsvector('simple', bld_name));

-- ============================================================
-- 시설물 유형 (맨홀, 관로, 밸브 등)
-- ============================================================
CREATE TABLE gis.facility_types (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,    -- 'MANHOLE', 'PIPE', 'VALVE' 등
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(20) NOT NULL,           -- 'N'(맨홀), 'P'(관로), 'F'(시설물)
    geom_type   VARCHAR(20) NOT NULL,           -- 'Point', 'LineString', 'Polygon'
    symbol_key  VARCHAR(50),                    -- 심볼 렌더링 키
    style       JSONB DEFAULT '{}'              -- 렌더링 스타일 (색상, 아이콘 등)
);

-- ============================================================
-- 시설물 데이터 - 범용 테이블 (다중 지역/유형)
-- ============================================================
CREATE TABLE gis.facilities (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    type_id     INTEGER REFERENCES gis.facility_types(id),
    fac_id      VARCHAR(50),                    -- 시설물 관리 번호
    geom        GEOMETRY(Geometry, 4326) NOT NULL,
    properties  JSONB DEFAULT '{}',             -- 유형별 가변 속성
    year        SMALLINT,                       -- 설치/측량 연도
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_facilities_geom ON gis.facilities USING GIST (geom);
CREATE INDEX idx_facilities_region ON gis.facilities (region_id);
CREATE INDEX idx_facilities_type ON gis.facilities (type_id);
CREATE INDEX idx_facilities_year ON gis.facilities (year);
CREATE INDEX idx_facilities_props ON gis.facilities USING GIN (properties);

-- ============================================================
-- 레이어 메타데이터 (dicLayers 하드코딩 대체)
-- ============================================================
CREATE TABLE gis.layers (
    id          SERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    code        VARCHAR(30) NOT NULL,           -- 레이어 코드
    name        VARCHAR(100) NOT NULL,          -- 표시명
    category    VARCHAR(20) NOT NULL,           -- 'basemap', 'facility', 'ortho'
    source_table VARCHAR(100),                  -- PostGIS 소스 테이블
    tile_url    VARCHAR(300),                   -- 사전 생성 타일 URL (MinIO)
    min_zoom    SMALLINT DEFAULT 0,
    max_zoom    SMALLINT DEFAULT 22,
    visible     BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    style       JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_layers_region_code ON gis.layers (region_id, code);

-- ============================================================
-- 데이터 수집 이력
-- ============================================================
CREATE TABLE audit.data_imports (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    filename    VARCHAR(300) NOT NULL,
    file_type   VARCHAR(10) NOT NULL,           -- 'shp', 'geojson', 'gpkg', 'csv'
    target_table VARCHAR(100) NOT NULL,
    record_count INTEGER,
    status      VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    error_msg   TEXT,
    minio_path  VARCHAR(500),                   -- 원본 파일 MinIO 경로
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 인증 (기존 tbl_user 대체)
-- ============================================================
CREATE TABLE auth.users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(100) NOT NULL,          -- bcrypt hash
    name        VARCHAR(100),
    role        VARCHAR(20) DEFAULT 'viewer',   -- 'admin', 'editor', 'viewer'
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 좌표계 전략

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| DB 저장 좌표계 | EPSG:5181 (Korea 2000) | **EPSG:4326 (WGS84)** |
| 프론트엔드 좌표계 | EPSG:3857 (Web Mercator) | **EPSG:3857** (MapLibre 기본) |
| 변환 위치 | SQL 내 ST_Transform | **pg_tileserv가 자동 변환** (MVT는 항상 3857) |
| 한국 지역 데이터 임포트 | 수동 좌표계 확인 | ogr2ogr `-t_srs EPSG:4326` 자동 변환 |

> **EPSG:4326으로 통일하는 이유**: 국제 표준이며, PostGIS의 geography 타입과 호환됩니다. MVT 서빙 시 pg_tileserv가 자동으로 3857 변환을 수행합니다. 한국 지역 데이터(5181, 5186 등)는 임포트 시 자동 변환됩니다.

### 3.3 Elasticsearch 주소 검색 인덱스

```json
{
  "mappings": {
    "properties": {
      "region_code": { "type": "keyword" },
      "address": {
        "type": "text",
        "analyzer": "nori",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "jibun": { "type": "text", "analyzer": "nori" },
      "building_name": { "type": "text", "analyzer": "nori" },
      "location": { "type": "geo_point" },
      "bbox": { "type": "geo_shape" },
      "type": { "type": "keyword" },
      "properties": { "type": "object", "enabled": false }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "nori": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["nori_readingform", "lowercase"]
        }
      }
    }
  }
}
```

> **nori 분석기**: Elasticsearch의 한국어 형태소 분석기. 기존 MyBatis LIKE 검색 대비 훨씬 정확한 한국어 주소 검색이 가능합니다.

---

## 4. API 설계

### 4.1 API 엔드포인트 구조

```
/api/v1/
├── regions/                          # 지역 관리
│   ├── GET    /                      # 전체 지역 목록 + bbox
│   ├── GET    /:code                 # 특정 지역 상세 (bbox, center, zoom)
│   └── POST   /                      # 신규 지역 등록 (admin)
│
├── search/                           # 검색 (Elasticsearch)
│   ├── GET    /address?q=&region=    # 주소 검색 (자동완성)
│   ├── GET    /parcel?q=&region=     # 지번 검색
│   ├── GET    /building?q=&region=   # 건물 검색
│   └── GET    /nearby?lat=&lng=&r=   # 반경 검색
│
├── layers/                           # 레이어 메타데이터
│   ├── GET    /?region=              # 지역별 레이어 목록 + 스타일
│   └── GET    /:id/style             # 레이어 스타일 JSON
│
├── facilities/                       # 시설물 CRUD
│   ├── GET    /?region=&type=&bbox=  # 시설물 조회 (bbox 필터)
│   ├── GET    /:id                   # 시설물 상세
│   ├── POST   /                      # 시설물 등록 (editor+)
│   └── PUT    /:id                   # 시설물 수정 (editor+)
│
├── import/                           # 데이터 수집
│   ├── POST   /upload                # 파일 업로드 → MinIO + Kafka 이벤트
│   ├── GET    /status/:id            # 수집 상태 조회
│   └── GET    /history?region=       # 수집 이력
│
├── auth/                             # 인증
│   ├── POST   /login                 # JWT 발급
│   ├── POST   /refresh               # 토큰 갱신
│   └── GET    /me                    # 현재 사용자 정보
│
└── tiles/                            # 타일 (pg_tileserv 프록시)
    ├── GET    /{table}/{z}/{x}/{y}.pbf    # 동적 벡터 타일
    └── GET    /static/{layer}/{z}/{x}/{y} # 사전 생성 타일 (MinIO)
```

### 4.2 동적 Bounding Box 시퀀스

```mermaid
sequenceDiagram
    participant Browser as 브라우저
    participant API as FastAPI
    participant PG as PostgreSQL + PostGIS
    participant Redis as Redis Cache

    Browser->>API: GET /api/v1/regions
    API->>Redis: 캐시 조회 (regions:list)
    alt 캐시 히트
        Redis-->>API: 캐시된 지역 목록
    else 캐시 미스
        API->>PG: SELECT code, name,<br/>ST_AsGeoJSON(bbox),<br/>ST_AsGeoJSON(center),<br/>zoom_min, zoom_max<br/>FROM gis.regions
        PG-->>API: 지역 목록 + bbox
        API->>Redis: 캐시 저장 (TTL 1h)
    end
    API-->>Browser: 지역 목록 (bbox, center, zoom)

    Browser->>Browser: 사용자 지역 선택 (예: 포천시)
    Browser->>Browser: map.fitBounds(bbox)<br/>동적으로 지도 범위 설정

    Browser->>API: GET /api/v1/layers?region=41150
    API->>PG: SELECT * FROM gis.layers<br/>WHERE region_id = ...
    API-->>Browser: 레이어 목록 + 스타일 + 타일 URL

    Browser->>Browser: MapLibre에 동적 레이어 추가<br/>(하드코딩 없이 서버 응답 기반)
```

### 4.3 데이터 수집 파이프라인 시퀀스

```mermaid
sequenceDiagram
    participant User as 관리자
    participant API as FastAPI
    participant MinIO as MinIO
    participant Kafka as Kafka
    participant Worker as Ingest Worker
    participant PG as PostgreSQL
    participant ES as Elasticsearch

    User->>API: POST /api/v1/import/upload<br/>(SHP/GeoJSON 파일)
    API->>MinIO: 원본 파일 저장<br/>(gis-raw/41150/2026/parcels.shp.zip)
    API->>PG: INSERT INTO audit.data_imports<br/>(status='pending')
    API->>Kafka: 이벤트 발행<br/>topic: gis.import.request<br/>{import_id, minio_path, region, target}
    API-->>User: 202 Accepted<br/>{import_id: 123}

    Kafka->>Worker: 이벤트 수신

    Worker->>MinIO: 파일 다운로드
    Worker->>Worker: ogr2ogr 변환<br/>좌표계 → EPSG:4326<br/>스키마 검증

    alt 검증 성공
        Worker->>PG: COPY INTO gis.parcels<br/>(bulk insert)
        Worker->>ES: 주소 데이터 색인<br/>(bulk index)
        Worker->>PG: UPDATE audit.data_imports<br/>SET status='completed'
        Worker->>Kafka: 이벤트 발행<br/>topic: gis.import.completed
    else 검증 실패
        Worker->>PG: UPDATE audit.data_imports<br/>SET status='failed',<br/>error_msg='...'
        Worker->>Kafka: 이벤트 발행<br/>topic: gis.import.failed
    end

    User->>API: GET /api/v1/import/status/123
    API->>PG: SELECT * FROM audit.data_imports<br/>WHERE id = 123
    API-->>User: {status: 'completed', record_count: 45000}
```

---

## 5. 프론트엔드 아키텍처

### 5.1 기술 스택

| 항목 | AS-IS | TO-BE | 이유 |
|------|-------|-------|------|
| 지도 라이브러리 | OpenLayers 5.3.0 | **MapLibre GL JS 5.x** | 벡터 타일 네이티브 지원, GPU 가속, 경량 |
| UI 프레임워크 | JSP + jQuery | **React 19 + TypeScript** | 컴포넌트 기반, 타입 안정성 |
| 3D 시각화 | 없음 | **deck.gl** (선택) | 3D 좌표 데이터 시각화 대비 |
| 상태 관리 | 전역 변수 | **Zustand** | 경량, React 호환 |
| 빌드 | 없음 (JSP 직접 서빙) | **Vite 6** | 빠른 HMR, 트리 셰이킹 |
| 레이어 트리 | Fancytree (jQuery) | **React 컴포넌트** | JSP 의존성 제거 |

### 5.2 프론트엔드 구조

```
src/
├── main.tsx                     # 앱 진입점
├── App.tsx                      # 라우터 + 레이아웃
├── api/                         # API 클라이언트
│   ├── client.ts                # axios/fetch 래퍼
│   ├── regions.ts               # 지역 API
│   ├── search.ts                # 검색 API
│   ├── layers.ts                # 레이어 API
│   └── facilities.ts            # 시설물 API
├── components/
│   ├── map/
│   │   ├── MapView.tsx          # MapLibre GL 컨테이너
│   │   ├── LayerManager.tsx     # 동적 레이어 관리
│   │   └── MapControls.tsx      # 줌/회전/측정 도구
│   ├── search/
│   │   ├── SearchBar.tsx        # 통합 검색
│   │   └── SearchResults.tsx    # 검색 결과 목록
│   ├── sidebar/
│   │   ├── LayerTree.tsx        # 레이어 트리 (Fancytree 대체)
│   │   ├── RegionSelector.tsx   # 지역 선택 드롭다운
│   │   └── FacilityDetail.tsx   # 시설물 상세 패널
│   └── admin/
│       ├── DataImport.tsx       # 데이터 업로드 UI
│       └── ImportHistory.tsx    # 수집 이력
├── stores/
│   ├── mapStore.ts              # 지도 상태 (현재 지역, 줌, bbox)
│   ├── layerStore.ts            # 레이어 활성화 상태
│   └── authStore.ts             # 인증 상태
└── styles/
    └── index.css                # Tailwind CSS
```

### 5.3 핵심: 지역 선택 → 동적 렌더링 흐름

```mermaid
flowchart LR
    A["RegionSelector\n지역 선택"] --> B["mapStore 갱신\n(bbox, center, zoom)"]
    B --> C["MapView\nmap.fitBounds(bbox)"]
    B --> D["API 호출\n/layers?region=X"]
    D --> E["layerStore 갱신\n(레이어 목록)"]
    E --> F["LayerManager\n동적 source/layer 추가"]
    F --> G["MapLibre\n벡터 타일 렌더링"]

    style A fill:#bbdefb
    style G fill:#c8e6c9
```

> **핵심 변화**: 지역/레이어 정보가 모두 서버 API에서 동적으로 제공됩니다. 프론트엔드에는 하드코딩된 좌표나 레이어 정보가 전혀 없습니다.

---

## 6. 인프라 배포 아키텍처

### 6.1 Docker Compose 추가 구성 (serengeti-iac 확장)

```yaml
# docker/layer3-apps/gis/docker-compose.yml
services:
  # ─── 벡터 타일 서버 ───
  pg-tileserv:
    image: pramsey/pg_tileserv:latest
    container_name: pg-tileserv
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${GIS_DB_NAME}"
    networks:
      - data-tier
      - proxy-tier
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:7800/healthz"]
      interval: 30s
      timeout: 10s
      retries: 5

  # ─── Feature 서버 ───
  pg-featureserv:
    image: pramsey/pg_featureserv:latest
    container_name: pg-featureserv
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${GIS_DB_NAME}"
    networks:
      - data-tier
      - proxy-tier
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # ─── FastAPI 백엔드 ───
  gis-api:
    build:
      context: ../../../app/gis-api
      dockerfile: Dockerfile
    container_name: gis-api
    environment:
      DATABASE_URL: "postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${GIS_DB_NAME}"
      REDIS_URL: "redis://:${REDIS_PASSWORD}@redis:6379/1"
      ELASTICSEARCH_URL: "http://elasticsearch:9200"
      ELASTICSEARCH_PASSWORD: "${ELASTIC_PASSWORD}"
      MINIO_ENDPOINT: "minio:9000"
      MINIO_ACCESS_KEY: "${MINIO_ROOT_USER}"
      MINIO_SECRET_KEY: "${MINIO_ROOT_PASSWORD}"
      KAFKA_BOOTSTRAP: "kafka:9092"
      JWT_SECRET: "${GIS_JWT_SECRET}"
    networks:
      - data-tier
      - proxy-tier
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  # ─── 데이터 수집 워커 ───
  gis-worker:
    build:
      context: ../../../app/gis-worker
      dockerfile: Dockerfile
    container_name: gis-worker
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${GIS_DB_NAME}"
      ELASTICSEARCH_URL: "http://elasticsearch:9200"
      MINIO_ENDPOINT: "minio:9000"
      MINIO_ACCESS_KEY: "${MINIO_ROOT_USER}"
      MINIO_SECRET_KEY: "${MINIO_ROOT_PASSWORD}"
      KAFKA_BOOTSTRAP: "kafka:9092"
      KAFKA_GROUP_ID: "gis-ingest-worker"
    networks:
      - data-tier
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_healthy
    restart: unless-stopped

  # ─── 프론트엔드 SPA ───
  gis-web:
    image: nginx:alpine
    container_name: gis-web
    volumes:
      - ../../../app/gis-web/dist:/usr/share/nginx/html:ro
      - ./nginx-spa.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - proxy-tier
    restart: unless-stopped

networks:
  proxy-tier:
    external: true
  data-tier:
    external: true
```

### 6.2 네트워크 토폴로지

```mermaid
graph LR
    subgraph Internet
        USER["사용자 브라우저"]
    end

    subgraph ProxyTier["proxy-tier 네트워크"]
        NPM["Nginx Proxy Manager\n:80/:443"]
        WEB["gis-web\n(React SPA)"]
        API["gis-api\n:8000"]
        TILE["pg-tileserv\n:7800"]
        FEAT["pg-featureserv\n:9000"]
    end

    subgraph DataTier["data-tier 네트워크"]
        PG["PostgreSQL 16\n+ PostGIS 3.4\n:5432"]
        REDIS["Redis 7\n:6379"]
        ES["Elasticsearch 8\n:9200"]
        MINIO["MinIO\n:9000"]
        KAFKA["Kafka 3.9\n:9092"]
        WORKER["gis-worker"]
    end

    USER -->|"HTTPS (Cloudflare Tunnel)"| NPM
    NPM -->|"/  → SPA"| WEB
    NPM -->|"/api/v1/* → :8000"| API
    NPM -->|"/api/tiles/* → :7800"| TILE
    NPM -->|"/api/features/* → :9000"| FEAT

    API --> PG
    API --> REDIS
    API --> ES
    API --> MINIO
    API --> KAFKA
    TILE --> PG
    FEAT --> PG
    WORKER --> PG
    WORKER --> ES
    WORKER --> MINIO
    WORKER --> KAFKA

    style ProxyTier fill:#fff3e0
    style DataTier fill:#fce4ec
```

### 6.3 PostgreSQL 이미지 변경

기존 serengeti-iac의 PostgreSQL을 PostGIS 지원 이미지로 교체:

```yaml
# docker/layer2-data/postgres/docker-compose.yml (수정)
services:
  postgres:
    image: postgis/postgis:16-3.4-alpine   # 변경: postgres:16-alpine → postgis
    # 나머지 설정 동일
```

> 이 변경은 기존 PostgreSQL과 100% 호환됩니다. PostGIS 확장은 `CREATE EXTENSION postgis`로 필요한 DB에서만 활성화합니다.

---

## 7. 마이그레이션 전략

### 7.1 단계별 마이그레이션 로드맵

```mermaid
gantt
    title GIS 시스템 현대화 마이그레이션 로드맵
    dateFormat YYYY-MM-DD
    axisFormat %m/%d

    section Phase 0: 인프라 준비
    PostGIS 이미지 교체          :p0a, 2026-04-01, 1d
    GIS DB 생성 + 스키마 적용     :p0b, after p0a, 1d
    MinIO 버킷/Kafka 토픽 생성   :p0c, after p0a, 1d
    ES nori 플러그인 + 인덱스     :p0d, after p0a, 1d

    section Phase 1: 데이터 마이그레이션
    포천시 지번 데이터 마이그레이션  :p1a, after p0b, 2d
    포천시 건물 데이터 마이그레이션  :p1b, after p0b, 2d
    시설물 데이터 마이그레이션      :p1c, after p1a, 3d
    ES 주소 색인                  :p1d, after p1a, 1d

    section Phase 2: 백엔드 개발
    FastAPI 프로젝트 셋업          :p2a, after p0d, 2d
    지역/검색 API 개발             :p2b, after p2a, 5d
    pg_tileserv 배포 + 설정       :p2c, after p1c, 2d
    데이터 수집 워커 개발           :p2d, after p2b, 5d

    section Phase 3: 프론트엔드 개발
    React + MapLibre 프로젝트 셋업 :p3a, after p2b, 2d
    지도 뷰 + 동적 레이어          :p3b, after p3a, 5d
    검색 + 시설물 상세             :p3c, after p3b, 3d
    데이터 관리 UI                 :p3d, after p3c, 3d

    section Phase 4: 통합 및 검증
    E2E 테스트                    :p4a, after p3d, 3d
    레거시 데이터 동등성 검증       :p4b, after p4a, 2d
    성능 튜닝 + 캐싱              :p4c, after p4b, 2d
```

### 7.2 데이터 마이그레이션 SQL

레거시 PostgreSQL 9.2(EPSG:5181) → 신규 PostgreSQL 16(EPSG:4326) 변환:

```sql
-- 1. 포천시 지역 등록
INSERT INTO gis.regions (code, name, bbox, center, srid_source) VALUES (
    '41150',
    '포천시',
    ST_Transform(ST_MakeEnvelope(
        191938.59, 530034.86,     -- 포천시 extent (EPSG:5181)
        234816.03, 586073.70,
        5181
    ), 4326),
    ST_Transform(ST_SetSRID(ST_MakePoint(206125, 558054), 5181), 4326),
    5181
);

-- 2. 지번 데이터 마이그레이션 (ua502 → parcels)
INSERT INTO gis.parcels (region_id, pnu, jibun, jimok, area_m2, geom, properties)
SELECT
    (SELECT id FROM gis.regions WHERE code = '41150'),
    pnu,
    jibun,
    jimok,
    area,
    ST_Transform(ST_SetSRID(geom, 5181), 4326),
    jsonb_build_object(
        'emd_cd', emd_cd,
        'ri_cd', ri_cd,
        'bon', bon,
        'bu', bu
    )
FROM ua502;

-- 3. 건물 데이터 마이그레이션 (buildig_txt → buildings)
INSERT INTO gis.buildings (region_id, bld_name, address, geom, properties)
SELECT
    (SELECT id FROM gis.regions WHERE code = '41150'),
    bld_nm,
    address,
    ST_Transform(ST_SetSRID(geom, 5181), 4326),
    jsonb_build_object(
        'bld_cd', bld_cd,
        'dong_nm', dong_nm,
        'floors', floors
    )
FROM buildig_txt;
```

### 7.3 AS-IS → TO-BE 기능 대응표

| AS-IS 기능 | AS-IS 구현 | TO-BE 구현 |
|-----------|-----------|-----------|
| 지도 렌더링 | OpenLayers + MVT 정적 파일 | MapLibre GL JS + pg_tileserv 동적 MVT |
| 정사영상 표시 | Node.js SQLite 타일 서빙 | MinIO + COG(Cloud Optimized GeoTIFF) |
| 지번 검색 | MyBatis LIKE + ST_AsGeoJSON | Elasticsearch nori + geo_point |
| 건물 검색 | MyBatis LIKE + ST_AsGeoJSON | Elasticsearch nori + geo_point |
| 레이어 토글 | Fancytree + 하드코딩 레이어 | React LayerTree + gis.layers API |
| 심볼 렌더링 | layer_symbol.json (113K 토큰) | gis.facility_types.style JSONB |
| 사용자 인증 | Spring Security + JSP 세션 | FastAPI + JWT |
| 관리자 기능 | JSP 폼 | React Admin 컴포넌트 |
| 타일 빌드 | 외부 수동 (파이프라인 없음) | Ingest Worker + tippecanoe 자동화 |

---

## 8. 핵심 개선 대상 리스트 (Action Items)

### 8.1 최우선 (Quick Win - Phase 0~1)

| # | 항목 | 현재 문제 | 개선 방법 | 영향 범위 |
|---|------|---------|----------|----------|
| 1 | **PostGIS 이미지 교체** | PostgreSQL 9.2 + PostGIS 2.1 | postgis/postgis:16-3.4-alpine | docker-compose.yml 1줄 |
| 2 | **GIS 스키마 적용** | 테이블명 하드코딩, sgg 필터 없음 | gis.regions/parcels/buildings/facilities | DDL 실행 |
| 3 | **데이터 마이그레이션** | EPSG:5181, 단일 지역 | EPSG:4326, region_id 기반 다중 지역 | SQL 마이그레이션 |
| 4 | **ES nori 플러그인** | MyBatis LIKE 검색 | 한국어 형태소 분석 기반 검색 | ES 플러그인 설치 |

### 8.2 핵심 리팩토링 (Phase 2~3)

| # | 항목 | 현재 문제 | 개선 방법 | 우선순위 |
|---|------|---------|----------|---------|
| 5 | **pg_tileserv 배포** | Node.js Express + SQLite + dicLayers 36개 수동 등록 | PostGIS 직접 MVT 서빙, 레이어 자동 발견 | 높음 |
| 6 | **FastAPI 백엔드** | Spring MVC 4.3.9 + MyBatis + JSP | 비동기 Python API, JWT 인증 | 높음 |
| 7 | **React SPA** | JSP + jQuery + OpenLayers 5.3.0 | React + MapLibre GL JS, 관심사 분리 | 높음 |
| 8 | **데이터 수집 파이프라인** | 파이프라인 완전 부재 | Kafka + Ingest Worker (ogr2ogr/tippecanoe) | 중간 |
| 9 | **XSS 취약점 제거** | search.js에 이스케이프 없는 innerHTML | React의 기본 XSS 방어 + CSP 헤더 | 높음 |

### 8.3 장기 개선 (Phase 4+)

| # | 항목 | 설명 |
|---|------|------|
| 10 | **COG 래스터 서빙** | 정사영상을 Cloud Optimized GeoTIFF로 변환, MinIO에서 직접 서빙 |
| 11 | **Neo4j 관로 분석** | 하수관로 네트워크를 그래프로 모델링, 흐름 분석/경로 탐색 |
| 12 | **실시간 센서 연동** | Kafka 스트림으로 IoT 센서 데이터(수위, 유량) 실시간 표시 |
| 13 | **PMTiles 오프라인** | 대용량 레이어를 PMTiles 포맷으로 사전 빌드, MinIO에서 HTTP Range 서빙 |
| 14 | **멀티 테넌시** | 지자체별 독립 환경 제공 (region 기반 데이터 격리) |

---

## 9. 성능 최적화 전략

### 9.1 캐싱 레이어

```
요청 흐름:
Browser → NPM → [Redis 캐시 체크] → pg_tileserv/FastAPI → PostgreSQL

캐시 전략:
├── Redis L1 (인메모리)
│   ├── 벡터 타일 캐시 (z/x/y 키, TTL 1h)
│   ├── 지역 목록 (TTL 24h)
│   ├── 레이어 메타데이터 (TTL 1h)
│   └── 검색 자동완성 (TTL 10m)
└── MinIO L2 (오브젝트 스토리지)
    ├── 사전 생성 PMTiles (영구)
    └── COG 래스터 (영구)
```

### 9.2 PostgreSQL 공간 인덱스 튜닝

```sql
-- GIST 인덱스 (기본)
CREATE INDEX idx_parcels_geom ON gis.parcels USING GIST (geom);

-- BRIN 인덱스 (대용량 시계열 시설물 데이터)
CREATE INDEX idx_facilities_geom_brin ON gis.facilities USING BRIN (geom)
    WITH (pages_per_range = 128);

-- 부분 인덱스 (특정 지역만 자주 조회)
CREATE INDEX idx_parcels_pocheon ON gis.parcels USING GIST (geom)
    WHERE region_id = 1;

-- pg_tileserv 성능을 위한 CLUSTER
CLUSTER gis.parcels USING idx_parcels_geom;
CLUSTER gis.facilities USING idx_facilities_geom;
```

### 9.3 AS-IS vs TO-BE 성능 비교 (예상)

| 항목 | AS-IS | TO-BE | 개선율 |
|------|-------|-------|-------|
| 타일 로딩 (z14) | ~200ms (SQLite 읽기) | ~50ms (PostGIS MVT + Redis) | **4x** |
| 주소 검색 | ~500ms (LIKE '%검색어%') | ~20ms (ES nori 인덱스) | **25x** |
| 새 지역 추가 | 2~3일 (수동 11~18곳 수정) | ~1시간 (파이프라인 자동화) | **20x+** |
| 동시 접속 | ~50명 (단일 Node.js) | ~1000명+ (pg_tileserv + Redis) | **20x** |
| 데이터 적재 | 수일 (수동 외부 도구) | ~30분 (자동 파이프라인) | **100x+** |

---

## 10. 보안 개선

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| CORS | `*` 전체 허용 | 화이트리스트 도메인만 허용 |
| 인증 | 세션 기반, DB 평문 비교 | JWT + bcrypt, 토큰 만료 |
| XSS | innerHTML 직접 삽입 | React 자동 이스케이프 + CSP 헤더 |
| SQL Injection | MyBatis `${}` 사용 가능성 | SQLAlchemy 파라미터 바인딩 |
| DB 크리덴셜 | 소스코드에 하드코딩 | 환경 변수 (.env) + Docker secrets |
| HTTPS | 없음 | Cloudflare Tunnel + NPM SSL 종단 |
| API 제한 | 없음 | FastAPI Rate Limiting 미들웨어 |

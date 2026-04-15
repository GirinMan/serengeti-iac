-- ============================================================
-- 지역 관리 (동적 Bounding Box의 핵심)
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.regions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    bbox        GEOMETRY(Polygon, 4326),
    center      GEOMETRY(Point, 4326),
    zoom_min    SMALLINT DEFAULT 10,
    zoom_max    SMALLINT DEFAULT 19,
    srid_source INTEGER DEFAULT 5181,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_bbox ON gis.regions USING GIST (bbox);

-- ============================================================
-- 시설물 유형 (맨홀, 관로, 밸브 등)
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.facility_types (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(20) NOT NULL,
    geom_type   VARCHAR(20) NOT NULL,
    symbol_key  VARCHAR(50),
    style       JSONB DEFAULT '{}'
);

-- ============================================================
-- 지번(필지) 데이터 - 다중 지역 지원
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.parcels (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    pnu         VARCHAR(19),
    jibun       VARCHAR(100),
    jimok       VARCHAR(10),
    area_m2     NUMERIC(12,2),
    geom        GEOMETRY(MultiPolygon, 4326) NOT NULL,
    properties  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_geom ON gis.parcels USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcels_region ON gis.parcels (region_id);
CREATE INDEX IF NOT EXISTS idx_parcels_jibun ON gis.parcels USING GIN (to_tsvector('simple', jibun));

-- ============================================================
-- 건물 데이터 - 다중 지역 지원
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.buildings (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    bld_name    VARCHAR(200),
    bld_use     VARCHAR(50),
    address     VARCHAR(300),
    floors      SMALLINT,
    geom        GEOMETRY(Geometry, 4326) NOT NULL,
    properties  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_geom ON gis.buildings USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_buildings_region ON gis.buildings (region_id);
CREATE INDEX IF NOT EXISTS idx_buildings_name ON gis.buildings USING GIN (to_tsvector('simple', bld_name));

-- ============================================================
-- 시설물 데이터 - 범용 테이블 (다중 지역/유형)
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.facilities (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    type_id     INTEGER REFERENCES gis.facility_types(id),
    fac_id      VARCHAR(50),
    geom        GEOMETRY(Geometry, 4326) NOT NULL,
    properties  JSONB DEFAULT '{}',
    year        SMALLINT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom ON gis.facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_region ON gis.facilities (region_id);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON gis.facilities (type_id);
CREATE INDEX IF NOT EXISTS idx_facilities_year ON gis.facilities (year);
CREATE INDEX IF NOT EXISTS idx_facilities_props ON gis.facilities USING GIN (properties);

-- ============================================================
-- 레이어 메타데이터 (dicLayers 하드코딩 대체)
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.layers (
    id          SERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    code        VARCHAR(30) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(20) NOT NULL,
    source_table VARCHAR(100),
    tile_url    VARCHAR(300),
    min_zoom    SMALLINT DEFAULT 0,
    max_zoom    SMALLINT DEFAULT 22,
    visible     BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    style       JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_layers_region_code ON gis.layers (region_id, code);

-- ============================================================
-- 데이터 수집 이력
-- ============================================================
CREATE TABLE IF NOT EXISTS audit.data_imports (
    id          BIGSERIAL PRIMARY KEY,
    region_id   INTEGER REFERENCES gis.regions(id),
    filename    VARCHAR(300) NOT NULL,
    file_type   VARCHAR(10) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    record_count INTEGER,
    status      VARCHAR(20) DEFAULT 'pending',
    error_msg   TEXT,
    minio_path  VARCHAR(500),
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 인증 (기존 tbl_user 대체)
-- ============================================================
CREATE TABLE IF NOT EXISTS auth.users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(100) NOT NULL,
    name        VARCHAR(100),
    role        VARCHAR(20) DEFAULT 'viewer',
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 시설물 type_code 역정규화 컬럼 및 Partial GiST 인덱스
-- (type_code: facility_types.code를 비정규화하여 부분 인덱스 활용)
-- ============================================================
ALTER TABLE gis.facilities ADD COLUMN IF NOT EXISTS type_code VARCHAR(20);

-- type_code 조회용 B-tree 인덱스
CREATE INDEX IF NOT EXISTS idx_facilities_type_code ON gis.facilities (type_code);

-- 시설물 유형별 Partial GiST Index: 자주 쓰이는 관로/맨홀 그룹별 분리
CREATE INDEX IF NOT EXISTS idx_facilities_geom_pipe
    ON gis.facilities USING GIST(geom)
    WHERE type_code LIKE PIPE_%;

CREATE INDEX IF NOT EXISTS idx_facilities_geom_manhole
    ON gis.facilities USING GIST(geom)
    WHERE type_code LIKE MANHOLE_%;

CREATE INDEX IF NOT EXISTS idx_facilities_geom_other
    ON gis.facilities USING GIST(geom)
    WHERE type_code NOT LIKE PIPE_% AND type_code NOT LIKE MANHOLE_%;

-- region_id + type_id 복합 B-tree: bbox 쿼리 전 행 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_facilities_region_type ON gis.facilities (region_id, type_id);

-- ============================================================
-- pg_tileserv용 공간 검색 함수들
-- PostGIS 테이블을 직접 MVT로 서빙할 때 사용
-- ============================================================

-- 지역별 시설물 조회 (pg_tileserv function layer)
CREATE OR REPLACE FUNCTION gis.facilities_by_region(
    z integer, x integer, y integer,
    region_code text DEFAULT NULL
)
RETURNS bytea
AS $$
DECLARE
    result bytea;
    bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);

    WITH mvtgeom AS (
        SELECT
            ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds) AS geom,
            f.id,
            f.fac_id,
            ft.code AS type_code,
            ft.name AS type_name,
            ft.category,
            f.year,
            f.properties
        FROM gis.facilities f
        JOIN gis.facility_types ft ON f.type_id = ft.id
        LEFT JOIN gis.regions r ON f.region_id = r.id
        WHERE ST_Intersects(f.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'facilities')
    INTO result
    FROM mvtgeom;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- 지역별 지번 조회
CREATE OR REPLACE FUNCTION gis.parcels_by_region(
    z integer, x integer, y integer,
    region_code text DEFAULT NULL
)
RETURNS bytea
AS $$
DECLARE
    result bytea;
    bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);

    WITH mvtgeom AS (
        SELECT
            ST_AsMVTGeom(ST_Transform(p.geom, 3857), bounds) AS geom,
            p.id,
            p.pnu,
            p.jibun,
            p.jimok,
            p.area_m2
        FROM gis.parcels p
        LEFT JOIN gis.regions r ON p.region_id = r.id
        WHERE ST_Intersects(p.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'parcels')
    INTO result
    FROM mvtgeom;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- 지역별 건물 조회
CREATE OR REPLACE FUNCTION gis.buildings_by_region(
    z integer, x integer, y integer,
    region_code text DEFAULT NULL
)
RETURNS bytea
AS $$
DECLARE
    result bytea;
    bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);

    WITH mvtgeom AS (
        SELECT
            ST_AsMVTGeom(ST_Transform(b.geom, 3857), bounds) AS geom,
            b.id,
            b.bld_name,
            b.bld_use,
            b.address,
            b.floors
        FROM gis.buildings b
        LEFT JOIN gis.regions r ON b.region_id = r.id
        WHERE ST_Intersects(b.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'buildings')
    INTO result
    FROM mvtgeom;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

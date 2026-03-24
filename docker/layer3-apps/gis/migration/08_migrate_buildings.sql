-- ============================================================
-- buildig_txt (건물) → gis.buildings 마이그레이션
-- 전제: staging.buildig_txt 테이블이 shp2pgsql로 이미 임포트되어 있어야 함
-- ============================================================

CREATE SCHEMA IF NOT EXISTS staging;

-- 마이그레이션 전 기존 포천시 데이터 삭제 (재실행 가능하도록)
DELETE FROM gis.buildings
WHERE region_id = (SELECT id FROM gis.regions WHERE code = 'POCHEON');

-- buildig_txt → gis.buildings 변환 삽입
INSERT INTO gis.buildings (region_id, bld_name, bld_use, address, floors, geom, properties)
SELECT
    r.id AS region_id,
    s.bldnm AS bld_name,
    NULL AS bld_use,
    CONCAT_WS(' ', s.sgg, s.emd, s.ri, s.jibun) AS address,
    NULL AS floors,
    ST_Transform(ST_SetSRID(s.geom, 5181), 4326) AS geom,
    jsonb_build_object(
        'pnu', s.pnu,
        'sgg', s.sgg,
        'emd', s.emd,
        'ri', s.ri,
        'jibun', s.jibun,
        'jimok', s.jimok
    ) AS properties
FROM staging.buildig_txt s
CROSS JOIN gis.regions r
WHERE r.code = 'POCHEON'
  AND s.geom IS NOT NULL;

-- 마이그레이션 이력 기록
INSERT INTO audit.data_imports (region_id, filename, file_type, target_table, record_count, status, completed_at)
SELECT
    r.id,
    'buildig_txt.shp',
    'shp',
    'gis.buildings',
    (SELECT count(*) FROM gis.buildings WHERE region_id = r.id),
    'completed',
    NOW()
FROM gis.regions r
WHERE r.code = 'POCHEON';

-- 검증
SELECT
    'gis.buildings' AS target,
    count(*) AS total_rows,
    count(DISTINCT properties->>'emd') AS emd_count,
    count(DISTINCT bld_name) AS unique_bldnm
FROM gis.buildings
WHERE region_id = (SELECT id FROM gis.regions WHERE code = 'POCHEON');

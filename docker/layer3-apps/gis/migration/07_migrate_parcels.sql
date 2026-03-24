-- ============================================================
-- ua502 (지번/필지) → gis.parcels 마이그레이션
-- 전제: staging.ua502 테이블이 shp2pgsql로 이미 임포트되어 있어야 함
-- ============================================================

-- 스테이징 스키마 생성 (없으면)
CREATE SCHEMA IF NOT EXISTS staging;

-- 마이그레이션 전 기존 포천시 데이터 삭제 (재실행 가능하도록)
DELETE FROM gis.parcels
WHERE region_id = (SELECT id FROM gis.regions WHERE code = 'POCHEON');

-- ua502 → gis.parcels 변환 삽입
-- shp2pgsql이 -s 5181 옵션으로 임포트했으므로 geom은 EPSG:5181
-- ST_Transform으로 EPSG:4326 변환, ST_Multi로 MultiPolygon 보장
INSERT INTO gis.parcels (region_id, pnu, jibun, jimok, area_m2, geom, properties)
SELECT
    r.id AS region_id,
    s.pnu,
    s.jibun,
    s.jimok,
    ST_Area(ST_Transform(s.geom, 5181))::NUMERIC(12,2) AS area_m2,
    ST_Multi(ST_Transform(ST_SetSRID(s.geom, 5181), 4326)) AS geom,
    jsonb_build_object(
        'sgg', s.sgg,
        'emd', s.emd,
        'ri', s.ri
    ) AS properties
FROM staging.ua502 s
CROSS JOIN gis.regions r
WHERE r.code = 'POCHEON'
  AND s.geom IS NOT NULL;

-- 마이그레이션 이력 기록
INSERT INTO audit.data_imports (region_id, filename, file_type, target_table, record_count, status, completed_at)
SELECT
    r.id,
    'ua502.shp',
    'shp',
    'gis.parcels',
    (SELECT count(*) FROM gis.parcels WHERE region_id = r.id),
    'completed',
    NOW()
FROM gis.regions r
WHERE r.code = 'POCHEON';

-- 검증
SELECT
    'gis.parcels' AS target,
    count(*) AS total_rows,
    count(DISTINCT properties->>'emd') AS emd_count,
    ST_AsText(ST_Centroid(ST_Collect(geom))) AS centroid_4326
FROM gis.parcels
WHERE region_id = (SELECT id FROM gis.regions WHERE code = 'POCHEON');

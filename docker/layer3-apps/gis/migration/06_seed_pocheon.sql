-- ============================================================
-- 포천시 지역 시드 데이터
-- 레거시 시스템의 하드코딩 좌표를 EPSG:4326으로 변환하여 등록
-- ============================================================

-- 레거시 하드코딩 값 (EPSG:3857):
--   Extent: [14144546, 4541736, 14206280, 4605288]
--   Center: [14162116, 4568592]

INSERT INTO gis.regions (code, name, bbox, center, zoom_min, zoom_max, srid_source)
VALUES (
    'POCHEON',
    '포천시',
    ST_Transform(
        ST_MakeEnvelope(14144546, 4541736, 14206280, 4605288, 3857),
        4326
    ),
    ST_Transform(
        ST_SetSRID(ST_MakePoint(14162116, 4568592), 3857),
        4326
    ),
    10,
    19,
    5181
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    bbox = EXCLUDED.bbox,
    center = EXCLUDED.center,
    updated_at = NOW();

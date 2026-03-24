-- ============================================================
-- 레이어 메타데이터 시드 (마이그레이션)
-- seed_facilities.sql의 레이어 정의와 동일하게 유지
-- pg_tileserv function layer URL 패턴 사용 (table layer도 fallback 가능)
-- ============================================================
-- 주의: seed_facilities.sql이 이 파일 이후 실행되며 동일 레이어를 UPSERT합니다.
--       두 파일의 레이어 정의를 항상 동기화하세요.

INSERT INTO gis.layers (region_id, code, name, category, source_table, tile_url, min_zoom, max_zoom, visible, sort_order, style) VALUES
    (1, 'PARCELS',         '필지',              'BASE',     'parcels',   '/gis.parcels_by_region/{z}/{x}/{y}.pbf', 14, 22, true, 10,
     '{"type":"fill","fill-color":"#e8d44d","fill-opacity":0.15,"fill-outline-color":"#b8a020"}'::jsonb),
    (1, 'PARCELS_LABELS',  '지번 라벨',         'BASE',     'parcels',   '/gis.parcels_by_region/{z}/{x}/{y}.pbf', 16, 22, true, 15,
     '{"type":"symbol","text-field":["get","jibun"],"text-size":["interpolate",["linear"],["zoom"],16,9,18,12,20,15],"text-anchor":"center","text-allow-overlap":false,"text-color":"#4a3800","text-halo-color":"#ffffff","text-halo-width":1.5,"text-padding":2}'::jsonb),
    (1, 'BUILDINGS',       '건물',              'BASE',     'buildings', '/gis.buildings_by_region/{z}/{x}/{y}.pbf', 14, 22, true, 20,
     '{"type":"fill","fill-color":"#d4856a","fill-opacity":0.4,"fill-outline-color":"#a05030"}'::jsonb),
    (1, 'BUILDINGS_LABELS','건물명 라벨',       'BASE',     'buildings', '/gis.buildings_by_region/{z}/{x}/{y}.pbf', 16, 22, true, 25,
     '{"type":"symbol","text-field":["get","bld_name"],"text-size":["interpolate",["linear"],["zoom"],16,9,18,11,20,14],"text-anchor":"center","text-allow-overlap":false,"text-color":"#5a2d0c","text-halo-color":"#ffffff","text-halo-width":1.5,"text-padding":2,"filter":["!=",["get","bld_name"],""]}'::jsonb),
    (1, 'FACILITY_NODES',  '시설물(맨홀/밸브)', 'FACILITY', 'facility_nodes', '/gis.facility_nodes/{z}/{x}/{y}.pbf', 13, 22, true, 30,
     '{"type":"circle","circle-color":["match",["get","type_code"],"MANHOLE_SEW","#e74c3c","MANHOLE_RAIN","#3498db","INLET_RAIN","#2ecc71","VALVE","#f39c12","PUMP","#9b59b6","#95a5a6"],"circle-radius":4,"circle-stroke-width":1,"circle-stroke-color":"#fff"}'::jsonb),
    (1, 'FACILITY_PIPES',  '시설물(관로)',      'FACILITY', 'facility_pipes', '/gis.facility_pipes/{z}/{x}/{y}.pbf', 13, 22, true, 40,
     '{"type":"line","line-color":["match",["get","type_code"],"PIPE_SEW","#e74c3c","PIPE_RAIN","#3498db","PIPE_COMBINED","#8e44ad","PIPE_TREATMENT","#27ae60","#95a5a6"],"line-width":2}'::jsonb)
ON CONFLICT (region_id, code) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, source_table = EXCLUDED.source_table,
    tile_url = EXCLUDED.tile_url, min_zoom = EXCLUDED.min_zoom, max_zoom = EXCLUDED.max_zoom,
    visible = EXCLUDED.visible, sort_order = EXCLUDED.sort_order, style = EXCLUDED.style;

-- 검증
SELECT code, name, category, min_zoom, max_zoom, visible
FROM gis.layers
WHERE region_id = 1
ORDER BY sort_order;

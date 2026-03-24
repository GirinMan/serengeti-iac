-- Pocheon facility infrastructure seed
-- Seeds: facility_types (10 new), tile functions, layers
-- Run after initdb schema creation

BEGIN;

-- ===== 1. Seed additional facility_types (beyond initial 7) =====
INSERT INTO gis.facility_types (code, name, category, geom_type, symbol_key) VALUES
    ('INLET_RAIN',      '우수받이',     'N', 'Point',      'N_INLET_RAIN'),
    ('MANHOLE_SUB',     '맨홀보조',     'N', 'Point',      'N_MANHOLE_SUB'),
    ('VALVE_SUB',       '밸브류',       'F', 'Point',      'F_VALVE_SUB'),
    ('GATE',            '수문',         'F', 'Point',      'F_GATE'),
    ('WELL',            '우물/월류',    'F', 'Point',      'F_WELL'),
    ('FACILITY_OTHER',  '기타시설',     'F', 'Point',      'F_OTHER'),
    ('PIPE_COMBINED',   '합류관',       'P', 'LineString', 'P_PIPE_COMBINED'),
    ('PIPE_PLAN',       '계획관로',     'P', 'LineString', 'P_PIPE_PLAN'),
    ('PIPE_TREATMENT',  '처리관로',     'P', 'LineString', 'P_PIPE_TREATMENT'),
    ('PIPE_OTHER',      '기타관로',     'P', 'LineString', 'P_PIPE_OTHER')
ON CONFLICT (code) DO NOTHING;

-- ===== 2. Tile-serving functions for pg_tileserv =====

-- All facilities (combined - used by general map view)
CREATE OR REPLACE FUNCTION gis.facilities_by_region(z integer, x integer, y integer, region_code text DEFAULT NULL)
RETURNS bytea LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE result bytea; bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);
    WITH mvtgeom AS (
        SELECT ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds) AS geom,
               f.id, f.fac_id, ft.code AS type_code, ft.name AS type_name, ft.category, f.year, f.properties
        FROM gis.facilities f
        JOIN gis.facility_types ft ON f.type_id = ft.id
        LEFT JOIN gis.regions r ON f.region_id = r.id
        WHERE ST_Intersects(f.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'facilities') INTO result FROM mvtgeom;
    RETURN result;
END; $$;

-- Facility nodes (Point geometries: manholes, valves, inlets, pumps)
CREATE OR REPLACE FUNCTION gis.facility_nodes(z integer, x integer, y integer, region_code text DEFAULT NULL)
RETURNS bytea LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE result bytea; bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);
    WITH mvtgeom AS (
        SELECT ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds) AS geom,
               f.id, f.fac_id, ft.code AS type_code, ft.name AS type_name, f.year, f.properties
        FROM gis.facilities f
        JOIN gis.facility_types ft ON f.type_id = ft.id
        LEFT JOIN gis.regions r ON f.region_id = r.id
        WHERE ft.geom_type = 'Point'
          AND ST_Intersects(f.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'facility_nodes') INTO result FROM mvtgeom;
    RETURN result;
END; $$;

-- Facility pipes (LineString geometries: all pipe types)
CREATE OR REPLACE FUNCTION gis.facility_pipes(z integer, x integer, y integer, region_code text DEFAULT NULL)
RETURNS bytea LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE result bytea; bounds geometry;
BEGIN
    bounds := ST_TileEnvelope(z, x, y);
    WITH mvtgeom AS (
        SELECT ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds) AS geom,
               f.id, f.fac_id, ft.code AS type_code, ft.name AS type_name, f.year, f.properties
        FROM gis.facilities f
        JOIN gis.facility_types ft ON f.type_id = ft.id
        LEFT JOIN gis.regions r ON f.region_id = r.id
        WHERE ft.geom_type = 'LineString'
          AND ST_Intersects(f.geom, ST_Transform(bounds, 4326))
          AND (region_code IS NULL OR r.code = region_code)
    )
    SELECT ST_AsMVT(mvtgeom, 'facility_pipes') INTO result FROM mvtgeom;
    RETURN result;
END; $$;

-- ===== 3. Register layers for frontend display =====
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

COMMIT;

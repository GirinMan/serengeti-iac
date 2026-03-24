-- Seed additional facility types for Pocheon MVT data import
-- Run before import_facilities.sh
--
-- Existing types (id 1-7): MANHOLE_SEW, MANHOLE_RAIN, PIPE_SEW, PIPE_RAIN, VALVE, PUMP, TREATMENT
-- New types below cover remaining LAYER_CD values from MVT tiles

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

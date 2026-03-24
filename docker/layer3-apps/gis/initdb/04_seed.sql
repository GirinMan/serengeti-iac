-- ============================================================
-- 시설물 유형 시드 데이터 (레거시 LAYER_CD 기반)
-- ============================================================
INSERT INTO gis.facility_types (code, name, category, geom_type, symbol_key) VALUES
    ('MANHOLE_SEW',  '하수맨홀',   'N', 'Point',      'N_MANHOLE_SEW'),
    ('MANHOLE_RAIN', '우수맨홀',   'N', 'Point',      'N_MANHOLE_RAIN'),
    ('PIPE_SEW',     '하수관로',   'P', 'LineString', 'P_PIPE_SEW'),
    ('PIPE_RAIN',    '우수관로',   'P', 'LineString', 'P_PIPE_RAIN'),
    ('VALVE',        '밸브',       'F', 'Point',      'F_VALVE'),
    ('PUMP',         '펌프',       'F', 'Point',      'F_PUMP'),
    ('TREATMENT',    '처리시설',   'F', 'Polygon',    'F_TREATMENT')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 기본 관리자 계정 (bcrypt hash for 'admin1234')
-- ============================================================
INSERT INTO auth.users (username, password, name, role) VALUES
    ('admin', '$2b$12$sAulqarbyZUypmlQp9IqtuYXxi/vdr5xT/.pz4xxH630yeZ4ot5W.', '관리자', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Phase 2: 긴급 보고, 시설물 수정 요청, 통계 Materialized View
-- ============================================================

-- ============================================================
-- 긴급 보고 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.emergency_reports (
    id          SERIAL PRIMARY KEY,
    location    GEOMETRY(Point, 4326) NOT NULL,
    address     TEXT,
    severity    VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category    VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    photos      TEXT[] DEFAULT '{}',
    status      VARCHAR(20) NOT NULL DEFAULT 'reported'
                    CHECK (status IN ('reported', 'dispatched', 'in_progress', 'resolved', 'closed')),
    reporter_id INTEGER REFERENCES auth.users(id),
    assigned_to INTEGER REFERENCES auth.users(id),
    region_id   INTEGER REFERENCES gis.regions(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_reports_location ON gis.emergency_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_status ON gis.emergency_reports (status);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_severity ON gis.emergency_reports (severity);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_created ON gis.emergency_reports (created_at DESC);

-- ============================================================
-- 시설물 수정 요청 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS gis.facility_edit_requests (
    id           SERIAL PRIMARY KEY,
    facility_id  BIGINT NOT NULL REFERENCES gis.facilities(id),
    requester_id INTEGER NOT NULL REFERENCES auth.users(id),
    reviewer_id  INTEGER REFERENCES auth.users(id),
    changes_json JSONB NOT NULL,
    reason       TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    review_comment TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON gis.facility_edit_requests (status);
CREATE INDEX IF NOT EXISTS idx_edit_requests_facility ON gis.facility_edit_requests (facility_id);
CREATE INDEX IF NOT EXISTS idx_edit_requests_requester ON gis.facility_edit_requests (requester_id);

-- ============================================================
-- 통계 Materialized View (시설물 유형/지역별 집계)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS gis.statistics_overview AS
SELECT
    r.id        AS region_id,
    r.name      AS region_name,
    ft.id       AS type_id,
    ft.name     AS type_name,
    ft.code     AS type_code,
    COUNT(f.id) AS facility_count,
    COUNT(f.id) FILTER (WHERE f.created_at >= CURRENT_DATE)                       AS today_count,
    COUNT(f.id) FILTER (WHERE f.created_at >= CURRENT_DATE - INTERVAL '7 days')   AS week_count,
    MIN(f.year) AS oldest_year,
    MAX(f.year) AS newest_year
FROM gis.facilities f
JOIN gis.regions r         ON f.region_id = r.id
JOIN gis.facility_types ft ON f.type_id   = ft.id
GROUP BY r.id, r.name, ft.id, ft.name, ft.code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_statistics_overview_pk
    ON gis.statistics_overview (region_id, type_id);

"""Tests for import endpoints: history, status, rollback."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text


@pytest.fixture()
async def seed_import(client, auth_headers):
    """Create a test import record directly in DB for testing status/rollback."""
    from app.database import get_db

    from tests.conftest import test_session_factory

    async with test_session_factory() as session:
        # Get a valid region_id
        result = await session.execute(text("SELECT id FROM gis.regions LIMIT 1"))
        region_id = result.scalar_one()

        now = datetime.now(UTC)
        result = await session.execute(
            text("""
                INSERT INTO audit.data_imports
                    (region_id, filename, file_type, target_table, status, record_count,
                     started_at, completed_at, created_at)
                VALUES
                    (:region_id, 'test_loop20.geojson', 'geojson', 'gis.facilities', 'completed', 0,
                     :started_at, :completed_at, :created_at)
                RETURNING id
            """),
            {
                "region_id": region_id,
                "started_at": now - timedelta(seconds=10),
                "completed_at": now - timedelta(seconds=5),
                "created_at": now,
            },
        )
        import_id = result.scalar_one()
        await session.commit()

    yield import_id

    # Cleanup: remove the test import record
    async with test_session_factory() as session:
        await session.execute(
            text("DELETE FROM audit.data_imports WHERE id = :id"),
            {"id": import_id},
        )
        await session.commit()


# --- History ---


async def test_import_history_requires_auth(client):
    resp = await client.get("/api/v1/import/history")
    assert resp.status_code == 401


async def test_import_history_returns_list(client, auth_headers):
    resp = await client.get("/api/v1/import/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


async def test_import_history_with_limit(client, auth_headers):
    resp = await client.get("/api/v1/import/history?limit=5", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) <= 5


# --- Status ---


async def test_import_status_not_found(client, auth_headers):
    resp = await client.get("/api/v1/import/status/999999", headers=auth_headers)
    assert resp.status_code == 404


async def test_import_status_requires_auth(client):
    resp = await client.get("/api/v1/import/status/1")
    assert resp.status_code == 401


async def test_import_status_success(client, auth_headers, seed_import):
    resp = await client.get(f"/api/v1/import/status/{seed_import}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == seed_import
    assert data["status"] == "completed"
    assert data["filename"] == "test_loop20.geojson"
    assert data["target_table"] == "gis.facilities"


# --- Rollback ---


async def test_rollback_requires_admin(client):
    resp = await client.delete("/api/v1/import/rollback/1")
    assert resp.status_code == 401


async def test_rollback_not_found(client, auth_headers):
    resp = await client.delete("/api/v1/import/rollback/999999", headers=auth_headers)
    assert resp.status_code == 404


async def test_rollback_success(client, auth_headers, seed_import):
    resp = await client.delete(f"/api/v1/import/rollback/{seed_import}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["import_id"] == seed_import
    assert data["status"] == "rolled_back"
    assert "deleted_count" in data

    # Verify status changed to rolled_back
    status_resp = await client.get(f"/api/v1/import/status/{seed_import}", headers=auth_headers)
    assert status_resp.json()["status"] == "rolled_back"


async def test_rollback_cannot_rollback_non_completed(client, auth_headers):
    """Cannot rollback import with status other than completed/failed."""
    from tests.conftest import test_session_factory

    async with test_session_factory() as session:
        result = await session.execute(text("SELECT id FROM gis.regions LIMIT 1"))
        region_id = result.scalar_one()

        result = await session.execute(
            text("""
                INSERT INTO audit.data_imports
                    (region_id, filename, file_type, target_table, status, created_at)
                VALUES
                    (:region_id, 'test_pending.geojson', 'geojson', 'gis.facilities', 'queued', now())
                RETURNING id
            """),
            {"region_id": region_id},
        )
        import_id = result.scalar_one()
        await session.commit()

    try:
        resp = await client.delete(f"/api/v1/import/rollback/{import_id}", headers=auth_headers)
        assert resp.status_code == 400
        assert "Cannot rollback" in resp.json()["detail"]
    finally:
        async with test_session_factory() as session:
            await session.execute(
                text("DELETE FROM audit.data_imports WHERE id = :id"),
                {"id": import_id},
            )
            await session.commit()

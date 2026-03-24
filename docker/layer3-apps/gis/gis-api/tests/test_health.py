async def test_health_simple(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


async def test_health_detail(client):
    resp = await client.get("/api/health", params={"detail": "true"})
    assert resp.status_code == 200
    data = resp.json()
    assert "checks" in data
    assert data["checks"]["database"] == "ok"

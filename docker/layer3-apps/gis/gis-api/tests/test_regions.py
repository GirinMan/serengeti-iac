async def test_list_regions(client):
    resp = await client.get("/api/v1/regions/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    region = data[0]
    assert "code" in region
    assert "name" in region
    assert "bbox" in region


async def test_get_region_by_code(client):
    list_resp = await client.get("/api/v1/regions/")
    regions = list_resp.json()
    if regions:
        code = regions[0]["code"]
        resp = await client.get(f"/api/v1/regions/{code}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == code


async def test_get_region_not_found(client):
    resp = await client.get("/api/v1/regions/nonexistent")
    assert resp.status_code == 404

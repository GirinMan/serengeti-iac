async def test_list_facility_types(client):
    resp = await client.get("/api/v1/facilities/types")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    ft = data[0]
    assert "id" in ft
    assert "code" in ft
    assert "name" in ft


async def test_list_facilities(client):
    resp = await client.get("/api/v1/facilities/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


async def test_list_facilities_with_bbox(client):
    resp = await client.get(
        "/api/v1/facilities/",
        params={"bbox": "127.1,37.8,127.3,38.0"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


async def test_get_facility(client):
    list_resp = await client.get("/api/v1/facilities/", params={"limit": 1})
    facilities = list_resp.json()
    if facilities:
        fac_id = facilities[0]["id"]
        resp = await client.get(f"/api/v1/facilities/{fac_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == fac_id
        assert "geojson" in data


async def test_get_facility_not_found(client):
    resp = await client.get("/api/v1/facilities/999999")
    assert resp.status_code == 404

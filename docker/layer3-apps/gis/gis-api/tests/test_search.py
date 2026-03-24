async def test_search_address(client):
    resp = await client.get("/api/v1/search/address", params={"q": "포천"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "results" in data
    assert data["total"] > 0


async def test_search_autocomplete(client):
    resp = await client.get("/api/v1/search/autocomplete", params={"q": "포천시"})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data


async def test_search_address_min_length(client):
    resp = await client.get("/api/v1/search/address", params={"q": ""})
    assert resp.status_code == 422


async def test_autocomplete_min_length(client):
    resp = await client.get("/api/v1/search/autocomplete", params={"q": "a"})
    assert resp.status_code == 422

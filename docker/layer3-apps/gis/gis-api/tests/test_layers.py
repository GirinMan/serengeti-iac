async def test_list_layers(client):
    resp = await client.get("/api/v1/layers/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    layer = data[0]
    assert "id" in layer
    assert "code" in layer
    assert "name" in layer
    assert "category" in layer


async def test_list_layers_by_region(client):
    regions_resp = await client.get("/api/v1/regions/")
    regions = regions_resp.json()
    if regions:
        code = regions[0]["code"]
        resp = await client.get("/api/v1/layers/", params={"region": code})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


async def test_get_layer_style(client):
    layers_resp = await client.get("/api/v1/layers/")
    layers = layers_resp.json()
    if layers:
        layer_id = layers[0]["id"]
        resp = await client.get(f"/api/v1/layers/{layer_id}/style")
        assert resp.status_code == 200


async def test_get_layer_style_not_found(client):
    resp = await client.get("/api/v1/layers/999999/style")
    assert resp.status_code == 404

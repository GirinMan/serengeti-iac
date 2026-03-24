from app.services.auth import create_access_token, decode_token, hash_password, verify_password


async def test_login_success(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


async def test_login_invalid_password(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_login_invalid_user(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent", "password": "whatever"},
    )
    assert resp.status_code == 401


async def test_get_me_unauthenticated(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_get_me_authenticated(client, auth_headers):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


def test_password_hash_verify():
    hashed = hash_password("test123")
    assert verify_password("test123", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_token_roundtrip():
    token = create_access_token({"sub": "testuser", "role": "viewer"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "testuser"
    assert payload["role"] == "viewer"


def test_jwt_invalid_token():
    assert decode_token("invalid.token.here") is None

async def test_register_creates_user_and_returns_token(client):
    response = await client.post("/api/auth/register", json={"email": "trader@example.com", "password": "correct-horse-battery"})
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "trader@example.com"
    assert body["access_token"]


async def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "correct-horse-battery"}
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 201
    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


async def test_login_rejects_wrong_password(client):
    await client.post("/api/auth/register", json={"email": "trader2@example.com", "password": "correct-horse-battery"})
    response = await client.post("/api/auth/login", json={"email": "trader2@example.com", "password": "wrong-password"})
    assert response.status_code == 401


async def test_login_succeeds_and_me_returns_profile(client):
    await client.post("/api/auth/register", json={"email": "trader3@example.com", "password": "correct-horse-battery"})
    login = await client.post("/api/auth/login", json={"email": "trader3@example.com", "password": "correct-horse-battery"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "trader3@example.com"


async def test_me_requires_authentication(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401

async def _auth_headers(client, email):
    await client.post("/api/auth/register", json={"email": email, "password": "correct-horse-battery"})
    login = await client.post("/api/auth/login", json={"email": email, "password": "correct-horse-battery"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_create_and_update_chart_layout(client):
    headers = await _auth_headers(client, "layouts@example.com")

    create = await client.post(
        "/api/chart-layouts",
        json={"name": "Default", "layout_type": "2-chart", "config": {"panes": [{"symbol": "NIFTY", "timeframe": "5m"}]}},
        headers=headers,
    )
    assert create.status_code == 201
    layout_id = create.json()["id"]
    assert create.json()["layout_type"] == "2-chart"

    update = await client.patch(f"/api/chart-layouts/{layout_id}", json={"is_default": True}, headers=headers)
    assert update.status_code == 200
    assert update.json()["is_default"] is True

    listed = await client.get("/api/chart-layouts", headers=headers)
    assert len(listed.json()) == 1


async def test_layout_not_visible_to_other_users(client):
    headers_a = await _auth_headers(client, "layout-owner@example.com")
    headers_b = await _auth_headers(client, "layout-intruder@example.com")

    create = await client.post("/api/chart-layouts", json={"name": "Private"}, headers=headers_a)
    layout_id = create.json()["id"]

    forbidden = await client.patch(f"/api/chart-layouts/{layout_id}", json={"name": "Hacked"}, headers=headers_b)
    assert forbidden.status_code == 404


async def test_preferences_default_and_update(client):
    headers = await _auth_headers(client, "prefs@example.com")

    initial = await client.get("/api/preferences", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["theme"] == "dark"

    updated = await client.patch("/api/preferences", json={"theme": "light", "default_timeframe": "15m"}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["theme"] == "light"
    assert updated.json()["default_timeframe"] == "15m"

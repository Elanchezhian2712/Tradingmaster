async def _auth_headers(client, email="wl-trader@example.com"):
    await client.post("/api/auth/register", json={"email": email, "password": "correct-horse-battery"})
    login = await client.post("/api/auth/login", json={"email": email, "password": "correct-horse-battery"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_create_watchlist_and_add_symbols(client):
    headers = await _auth_headers(client)

    create = await client.post("/api/watchlists", json={"name": "My Stocks"}, headers=headers)
    assert create.status_code == 201
    watchlist_id = create.json()["id"]

    add = await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "RELIANCE"}, headers=headers)
    assert add.status_code == 201
    assert add.json()["symbols"][0]["symbol"] == "RELIANCE"


async def test_cannot_add_duplicate_symbol(client):
    headers = await _auth_headers(client, "wl-trader2@example.com")
    create = await client.post("/api/watchlists", json={"name": "F&O"}, headers=headers)
    watchlist_id = create.json()["id"]

    await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "NIFTY"}, headers=headers)
    dup = await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "NIFTY"}, headers=headers)
    assert dup.status_code == 409


async def test_watchlist_is_scoped_to_owner(client):
    headers_a = await _auth_headers(client, "owner-a@example.com")
    headers_b = await _auth_headers(client, "owner-b@example.com")

    create = await client.post("/api/watchlists", json={"name": "Private"}, headers=headers_a)
    watchlist_id = create.json()["id"]

    forbidden = await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "TCS"}, headers=headers_b)
    assert forbidden.status_code == 404


async def test_reorder_symbols(client):
    headers = await _auth_headers(client, "reorder@example.com")
    create = await client.post("/api/watchlists", json={"name": "Reorder"}, headers=headers)
    watchlist_id = create.json()["id"]

    first = (await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "AAA"}, headers=headers)).json()
    second = (await client.post(f"/api/watchlists/{watchlist_id}/symbols", json={"symbol": "BBB"}, headers=headers)).json()
    first_id = first["symbols"][0]["id"]
    second_id = second["symbols"][1]["id"]

    reordered = await client.put(
        f"/api/watchlists/{watchlist_id}/symbols/reorder",
        json=[{"symbol_id": first_id, "position": 1}, {"symbol_id": second_id, "position": 0}],
        headers=headers,
    )
    assert reordered.status_code == 200
    symbols = sorted(reordered.json()["symbols"], key=lambda s: s["position"])
    assert symbols[0]["symbol"] == "BBB"
    assert symbols[1]["symbol"] == "AAA"

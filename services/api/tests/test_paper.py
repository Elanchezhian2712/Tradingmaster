async def _auth_headers(client, email):
    await client.post("/api/auth/register", json={"email": email, "password": "correct-horse-battery"})
    login = await client.post("/api/auth/login", json={"email": email, "password": "correct-horse-battery"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _trade(client_trade_id, pnl=100.0, symbol="RELIANCE"):
    return {
        "client_trade_id": client_trade_id,
        "symbol": symbol,
        "product": "MIS",
        "side": "BUY",
        "quantity": 10,
        "entry_price": 2500.0,
        "exit_price": 2510.0,
        "entry_time": "2026-09-17T09:20:00+05:30",
        "exit_time": "2026-09-17T09:45:00+05:30",
        "pnl": pnl,
        "charges": 0.0,
    }


SNAPSHOT = {
    "version": 1,
    "orders": [{"id": "o-1", "symbol": "RELIANCE", "status": "open"}],
    "positions": [{"symbol": "RELIANCE", "product": "MIS", "quantity": 5}],
    "trades": [],
    "lastPrices": [["RELIANCE", 2500.0]],
    "grossRealizedPnl": 100.0,
    "totalCharges": 0.0,
}


async def test_book_starts_empty_rather_than_404(client):
    headers = await _auth_headers(client, "paper-new@example.com")

    response = await client.get("/api/paper/book", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"snapshot": {}, "trades": [], "updated_at": None}


async def test_put_then_get_round_trips_the_book(client):
    headers = await _auth_headers(client, "paper-roundtrip@example.com")

    put = await client.put("/api/paper/book", json={"snapshot": SNAPSHOT, "trades": [_trade("t-1")]}, headers=headers)
    assert put.status_code == 200

    got = await client.get("/api/paper/book", headers=headers)
    assert got.status_code == 200
    assert got.json()["snapshot"] == SNAPSHOT
    assert got.json()["updated_at"] is not None
    assert [t["client_trade_id"] for t in got.json()["trades"]] == ["t-1"]
    assert got.json()["trades"][0]["pnl"] == 100.0
    assert got.json()["trades"][0]["product"] == "MIS"


async def test_snapshot_is_replaced_but_trades_accumulate(client):
    headers = await _auth_headers(client, "paper-accumulate@example.com")

    await client.put("/api/paper/book", json={"snapshot": SNAPSHOT, "trades": [_trade("t-1")]}, headers=headers)
    second = {**SNAPSHOT, "orders": [], "grossRealizedPnl": 250.0}
    await client.put("/api/paper/book", json={"snapshot": second, "trades": [_trade("t-2", pnl=150.0)]}, headers=headers)

    got = (await client.get("/api/paper/book", headers=headers)).json()
    assert got["snapshot"] == second
    assert got["snapshot"]["orders"] == []
    assert sorted(t["client_trade_id"] for t in got["trades"]) == ["t-1", "t-2"]


async def test_resending_a_trade_does_not_duplicate_it(client):
    headers = await _auth_headers(client, "paper-retry@example.com")

    # The client cannot know whether a dropped response meant the write landed,
    # so it re-sends the same batch. That must not book the trade twice.
    payload = {"snapshot": SNAPSHOT, "trades": [_trade("t-1"), _trade("t-2", pnl=50.0)]}
    await client.put("/api/paper/book", json=payload, headers=headers)
    await client.put("/api/paper/book", json=payload, headers=headers)
    await client.put("/api/paper/book", json={"snapshot": SNAPSHOT, "trades": [_trade("t-2", pnl=50.0)]}, headers=headers)

    got = (await client.get("/api/paper/book", headers=headers)).json()
    assert sorted(t["client_trade_id"] for t in got["trades"]) == ["t-1", "t-2"]
    assert sum(t["pnl"] for t in got["trades"]) == 150.0


async def test_one_users_book_is_invisible_to_another(client):
    headers_a = await _auth_headers(client, "paper-owner@example.com")
    headers_b = await _auth_headers(client, "paper-other@example.com")

    await client.put("/api/paper/book", json={"snapshot": SNAPSHOT, "trades": [_trade("t-1")]}, headers=headers_a)

    other = (await client.get("/api/paper/book", headers=headers_b)).json()
    assert other["snapshot"] == {}
    assert other["trades"] == []

    # The same client trade id from a different user is a different trade.
    await client.put("/api/paper/book", json={"snapshot": {}, "trades": [_trade("t-1", pnl=999.0)]}, headers=headers_b)
    assert (await client.get("/api/paper/book", headers=headers_a)).json()["trades"][0]["pnl"] == 100.0
    assert (await client.get("/api/paper/book", headers=headers_b)).json()["trades"][0]["pnl"] == 999.0


async def test_delete_resets_the_account(client):
    headers = await _auth_headers(client, "paper-reset@example.com")
    await client.put("/api/paper/book", json={"snapshot": SNAPSHOT, "trades": [_trade("t-1")]}, headers=headers)

    deleted = await client.delete("/api/paper/book", headers=headers)
    assert deleted.status_code == 204

    got = (await client.get("/api/paper/book", headers=headers)).json()
    assert got["snapshot"] == {}
    assert got["trades"] == []

    # A trade id used before the reset can be used again afterwards.
    await client.put("/api/paper/book", json={"snapshot": {}, "trades": [_trade("t-1", pnl=7.0)]}, headers=headers)
    assert (await client.get("/api/paper/book", headers=headers)).json()["trades"][0]["pnl"] == 7.0


async def test_book_requires_authentication(client):
    assert (await client.get("/api/paper/book")).status_code == 401
    assert (await client.put("/api/paper/book", json={"snapshot": {}})).status_code == 401
    assert (await client.delete("/api/paper/book")).status_code == 401


async def test_rejects_a_malformed_trade(client):
    headers = await _auth_headers(client, "paper-invalid@example.com")

    bad_quantity = {**_trade("t-bad"), "quantity": 0}
    response = await client.put("/api/paper/book", json={"snapshot": {}, "trades": [bad_quantity]}, headers=headers)
    assert response.status_code == 422

    # Nothing was written.
    assert (await client.get("/api/paper/book", headers=headers)).json()["trades"] == []

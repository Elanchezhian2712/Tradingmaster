# API

FastAPI auto-generates a full OpenAPI 3.1 spec from the code — run the
service and open `/docs` (Swagger UI) or `/redoc`, or fetch the raw schema
at `/openapi.json`. This document is a map, not a duplicate of that spec.

Base path: `/api`. All endpoints below (except `/health`, `/ready`,
`/api/auth/register`, `/api/auth/login`) require `Authorization: Bearer
<token>`.

## Auth — `/api/auth`

| Method | Path | Notes |
|---|---|---|
| POST | `/register` | Creates a user + a default `user_preferences` row, returns a token |
| POST | `/login` | Returns a token |
| GET | `/me` | Current user's profile |

Tokens are HS256 JWTs, subject = user id, expiry configurable via
`ACCESS_TOKEN_EXPIRE_MINUTES` (default 24h). There is no refresh-token flow
yet — see `docs/FUTURE.md`.

## Watchlists — `/api/watchlists`

| Method | Path | Notes |
|---|---|---|
| GET | `` | List the caller's watchlists with their symbols |
| POST | `` | Create a watchlist |
| DELETE | `/{id}` | Delete a watchlist (cascades to its symbols) |
| POST | `/{id}/symbols` | Add a symbol (409 if already present) |
| DELETE | `/{id}/symbols/{symbol_id}` | Remove a symbol |
| PUT | `/{id}/symbols/reorder` | Bulk-set `position` for a set of symbol ids |

Every route 404s (not 403) if the watchlist belongs to a different user —
existence isn't leaked across accounts.

## Chart layouts — `/api/chart-layouts`

| Method | Path | Notes |
|---|---|---|
| GET | `` | List the caller's layouts |
| POST | `` | Create (`layout_type`: `single` \| `2-chart` \| `4-chart`) |
| PATCH | `/{id}` | Partial update (name/config/is_default) |
| DELETE | `/{id}` | Delete |

`config` is an opaque JSON object owned by the frontend (per-pane symbol,
timeframe, indicator refs, scale mode, drawing sync settings). The API
does not validate its internal shape — that keeps the schema stable while
the frontend's layout format evolves.

## Preferences — `/api/preferences`

| Method | Path | Notes |
|---|---|---|
| GET | `` | Returns (and lazily creates) the caller's preferences |
| PATCH | `` | Partial update (theme / default_timeframe / keyboard_shortcuts) |

## Health — unauthenticated

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness — process is up, no DB touch |
| GET | `/ready` | Readiness — runs `SELECT 1` against Postgres |

## Not yet exposed over HTTP

Scanner rules, alerts, strategies, backtests, and paper trades have real
database tables (`docs/DATABASE.md`) but no router yet — building their
engines (rule evaluation, backtest execution, ...) is the right point to
also add their CRUD endpoints, rather than shipping endpoints that write
rows nothing ever reads. See `docs/FUTURE.md`.

## Error shape

Validation errors: FastAPI/Pydantic's standard `{"detail": [...]}` (422).
Everything else raised deliberately: `{"detail": "<message>"}` with the
matching status code (401/403/404/409). Anything unexpected: a logged
stack trace server-side and a generic `{"detail": "Internal server
error"}` (500) — no internal details leak to the client.

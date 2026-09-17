# Testing

## Frontend (TypeScript)

```bash
npm test                    # all workspaces (vitest)
npm run typecheck           # all workspaces (tsc --noEmit)
npm run test -w packages/indicators     # one workspace
```

Current coverage (30 tests):

- **`packages/market-data`** (5 tests) — mock candle generation is
  deterministic for a fixed seed, OHLC values stay internally consistent,
  daily candles skip weekends, and re-bucketing a finer series into a
  coarser one preserves total volume.
- **`packages/indicators`** (11 tests) — SMA/EMA/RSI/Bollinger match known
  formulas, and, most importantly, **every incremental indicator is
  checked against a full recompute**: seed on `N-5` bars, stream the last 5
  via `update()`, assert the result matches a full compute over all `N`
  bars. This is what actually verifies the "no full recompute per tick"
  architectural claim, not just an assertion in a comment.
- **`packages/chart-engine`** (14 tests) — `Viewport` index/pixel and
  price/pixel round-trips (including that `zoomAtPixel` keeps the index
  under the cursor fixed), pane layout proportions, `CandleStore` append/
  prepend/replace-last/binary-search, and `DrawingManager` hit-testing.

## Backend (Python)

Needs Postgres reachable at `DATABASE_URL` (see
`services/api/.env.example`; `docker compose up -d postgres` starts one on
the non-default port used there to avoid clashing with a Postgres you may
already have running locally).

```bash
cd services/api
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
alembic upgrade head        # only needed once per fresh database
pytest -q
```

14 tests, run against a real database (not sqlite or mocks) so the actual
async SQLAlchemy + asyncpg + Alembic path is what's verified:

- `test_health.py` — liveness and readiness (readiness genuinely queries
  Postgres).
- `test_auth.py` — register/login/duplicate-email/wrong-password/`me`
  requires a bearer token.
- `test_watchlists.py` — create, add/remove symbols, duplicate-symbol
  rejection, cross-user isolation (404s, not 403s, so existence isn't
  leaked), reordering.
- `test_chart_layouts_and_preferences.py` — create/update a layout,
  cross-user isolation, preferences default + partial update.

A fixture (`tests/conftest.py`) drops and recreates the whole schema before
every test, so tests never depend on execution order or leftover rows.

## What's proven vs. what's aspirational

Both suites above were actually executed while building this project (not
just written) — 30/30 frontend tests and 14/14 backend tests pass as of the
last run. The chart itself was additionally driven end-to-end with a
headless-Chromium script (candle/volume rendering, crosshair, wheel zoom,
adding an indicator, running the 10k-500k benchmark suite) to catch the
class of bug unit tests can't: a React effect double-invocation bug that
silently killed the market-data Web Worker, and a CSS specificity conflict
between a stylesheet rule and `ChartEngine`'s own inline `position` style
that collapsed the chart canvas to zero height. Both were real bugs caught
by actually running the app, not hypothetical.

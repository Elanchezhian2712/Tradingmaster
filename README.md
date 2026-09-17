# TradingMaster

An India-focused web trading/charting platform, built around one
non-negotiable requirement: the chart stays smooth from 10 candles to
500,000. Everything else — auth, watchlists, layouts — is ordinary web-app
work built around that core.

Not a clone of any existing product. Built from scratch: a custom WebGL2 +
Canvas2D chart renderer, an incremental (not full-recompute) indicator
engine, and a provider-agnostic mock market-data layer so the whole thing
runs and benchmarks with zero external dependencies.

## Status: Phase 1 (chart engine) complete and verified

- Candlestick + volume rendering, crosshair, tooltip, pan/zoom (drag +
  mouse wheel), dark/light theme, all 10 timeframes (1m → 1M), responsive
  resizing.
- Benchmarked at 10k / 50k / 100k / 500k candles — render time stays flat
  (~20-30ms) regardless of dataset size; see `docs/BENCHMARKS.md` for real
  measured numbers, not estimates.
- 11 indicators (SMA, EMA, WMA, VWAP, RSI, MACD, ATR, ADX, Supertrend,
  Bollinger Bands, volume average/spike), each with O(1)-or-O(period)
  incremental updates, verified against full recompute by unit test.
- 12 drawing tools (trend line, ray, rectangle, channel, Fibonacci
  retracement/extension, text, arrow, price/date range, ...).
- A working FastAPI backend (auth, watchlists, chart layouts, user
  preferences) backed by real PostgreSQL, with 14 passing tests.
- 30 frontend tests + 14 backend tests, all green; the app was also driven
  end-to-end in a real (headless) browser to catch what unit tests can't —
  see `docs/TESTING.md`.

What's *not* built yet — scanner, alerts, strategy builder, backtesting,
options chain, a real market-data vendor — is listed honestly in
`docs/FUTURE.md`, with the database schema already in place for all of it.

## Quick start

```bash
npm install
npm run dev              # apps/web on http://localhost:5173 (mock data, no backend needed to try the chart)
```

For the backend (auth/watchlists/layouts):

```bash
docker compose up -d postgres
cd services/api
python -m venv .venv && .venv/Scripts/activate    # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload                     # http://localhost:8000/docs
```

See `docs/DEPLOYMENT.md` for the full Docker Compose stack and production
notes, and `docs/TESTING.md` to run both test suites.

## Repository layout

```
apps/web/                   React + Vite UI shell — no chart rendering happens here
packages/chart-engine/      WebGL2 + Canvas2D chart core (framework-agnostic)
packages/indicators/        Indicator math: full-compute + incremental update
packages/market-data/       Provider-agnostic types + mock NSE-hours-aware provider
services/api/               FastAPI: auth, watchlists, layouts, preferences
docs/                        Architecture, API, DB schema, WebSocket protocol,
                              benchmarks, testing, deployment, future work
docker-compose.yml           Postgres + Redis + API
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — why it's built this way
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema
- [`docs/API.md`](docs/API.md) — REST endpoints (also live at `/docs` on the running API)
- [`docs/WEBSOCKET_PROTOCOL.md`](docs/WEBSOCKET_PROTOCOL.md) — market-data message protocol
- [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) — measured performance numbers
- [`docs/TESTING.md`](docs/TESTING.md) — how to run both test suites
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — local/Docker/production setup
- [`docs/FUTURE.md`](docs/FUTURE.md) — what's next, and why it's not built yet

## Principles this codebase follows

1. **Performance > correctness > scalability > UX > features**, in that
   order, whenever they conflict.
2. The chart is never a React component that re-renders on data — it's an
   imperative class React mounts once.
3. No fabricated data presented as real: the mock provider is clearly
   named and documented as mock; no F&O/options/market-breadth field is
   invented where no real data source exists yet.
4. Every "it's fast" or "it works" claim in `docs/` is backed by a test or
   a measured benchmark run, not an assertion in a comment.

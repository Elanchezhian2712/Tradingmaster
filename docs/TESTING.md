# Testing

## Frontend (TypeScript)

```bash
npm test                    # all workspaces (vitest)
npm run typecheck           # all workspaces (tsc --noEmit)
npm run test -w packages/indicators     # one workspace
```

Current coverage (93 tests):

- **`packages/market-data`** (14 tests) — mock candle generation is
  deterministic for a fixed seed, OHLC values stay internally consistent,
  daily candles skip weekends, and re-bucketing a finer series into a
  coarser one preserves total volume. Plus the provider's price coherence:
  a symbol quotes at the price its series *ends* at on every timeframe,
  successive polls walk continuously instead of teleporting, scaling a
  series to its end price keeps OHLC consistent, and the live price can be
  anchored to a loaded series. And the one that matters most for how the
  chart looks: a live 5-minute bar has to come out the same size as a
  historical 5-minute bar (within 2x), a step scales by elapsed time so
  polling more often does not add volatility, and one step is capped so a
  backgrounded tab does not jump on return.
- **`packages/indicators`** (11 tests) — SMA/EMA/RSI/Bollinger match known
  formulas, and, most importantly, **every incremental indicator is
  checked against a full recompute**: seed on `N-5` bars, stream the last 5
  via `update()`, assert the result matches a full compute over all `N`
  bars. This is what actually verifies the "no full recompute per tick"
  architectural claim, not just an assertion in a comment.
- **`packages/paper-trading`** (46 tests) — fill semantics for MARKET,
  LIMIT, SL and SL-M (including a stop that gaps past its own limit and so
  stays triggered-but-unfilled), position netting (average-up, partial
  exit, close, reverse), MIS/CNC separation, short P&L, margin blocking and
  insufficient-funds rejection, charges, cancel/modify, square-off-all,
  event ordering, and a JSON round-trip that keeps matching where it left
  off. Brackets get their own file: leg placement on fill, target-fills-
  cancels-stop and stop-fills-cancels-target, manual cancel taking the whole
  bracket, legs dropped when the position is closed another way, legs on the
  wrong side of the entry rejected, and an entry that fills already through
  its stop exiting at market. Plus IST session arithmetic — minute-of-day,
  the day key rolling at IST midnight rather than UTC midnight, weekends, and
  firing once per day. The engine takes an injected clock and id factory, so
  none of this depends on wall-clock time or randomness.
- **`packages/chart-engine`** (22 tests) — `Viewport` index/pixel and
  price/pixel round-trips (including that `zoomAtPixel` keeps the index
  under the cursor fixed), pane layout proportions, `CandleStore` append/
  prepend/replace-last/binary-search, `DrawingManager` hit-testing, and the
  price-line grab test (grab distance, non-draggable lines ignored, closest
  line wins, stable on a tie) — extracted as a pure function precisely so it
  can be tested without a DOM or a WebGL context.

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
just written) — 67/67 frontend tests pass as of the last run, and 14/14
backend tests passed when they were last run against Postgres.

The app was additionally driven end-to-end with a headless-Chromium script
over the Chrome DevTools Protocol (no browser-automation dependency), which
is what catches the class of bug unit tests cannot.

Phase 1 caught: a React effect double-invocation bug that silently killed
the market-data Web Worker, and a CSS specificity conflict between a
stylesheet rule and `ChartEngine`'s own inline `position` style that
collapsed the chart canvas to zero height.

Phase 2 drove the trading UI — place a MARKET buy, watch the position
mark to market, rest a LIMIT order, exit from the positions tab, check the
trade log, reload the page, move the crosshair — and caught two more real
bugs:

1. **A resting order filled at a price the market never traded at.** The
   watchlist quote poll seeded a symbol at its series *start* price while
   the chart anchored the live feed to its *end* price — ~8% apart for
   RELIANCE. Every mock series for a symbol is now scaled to end at one
   canonical price, and a test asserts it holds across timeframes.
2. **The crosshair's price and time labels were invisible.** They were
   drawn before the axis-gutter background fills, which painted over them.
   Everything that writes into a gutter now runs after those fills.

Neither was hypothetical, and neither was reachable from a unit test.

The bracket / drag-to-modify work was driven the same way — place a
bracketed entry, check both legs appear, rest an order, hover it, drag it
and confirm the order moved, then pan the chart to check ordinary panning
still works. That run found a third bug class:

3. **Bracket legs were invisible on the chart.** The price axis auto-scales
   to the visible candles, so a stop or target placed 1% away fell outside
   the range and its line was simply skipped — the levels existed in the
   book but nowhere on screen. Off-screen levels now pin their label to the
   edge they went past, dimmed and with an arrow, and several past the same
   edge stack instead of overprinting.

A fourth bug came from a user screenshot rather than a script, and is the
most visible of the lot:

4. **Live bars dwarfed the historical ones.** The tick simulator walked the
   price by a hardcoded +/-0.2% per tick, unrelated to the `dailyVolatility`
   the historical generator uses. Measured, a live 5-minute bar moved ~1.94%
   against ~0.088% for a historical one — **22x**. The price axis auto-scales
   to fit, so minutes after opening the app the whole history collapsed into
   a flat line with a cliff at the right edge. Both now scale through one
   shared `stepVolatility(dailyVolatility, seconds)` helper, and the test
   above compares them directly so they cannot drift apart again.

The drag was verified by reading the overlay canvas pixels to locate the
line (a full-width row of the line colour, which a candle of the same colour
cannot fake), dispatching a real press/move/release over it, and asserting
the order's price changed in the orders table.

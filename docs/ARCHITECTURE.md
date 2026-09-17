# Architecture

## Why this shape

The chart is the product. Everything else — auth, watchlists, scanners — is
ordinary CRUD that any web-app stack handles well. The chart is not: it has
to stay smooth from 10 candles to 500,000, it has to ingest a live tick
stream without stalling the UI, and it has to run indicator math on every
tick without redoing 500,000 bars of history each time. The whole system is
designed around keeping that one thing fast, and keeping everything else
out of its way.

## Monorepo layout

```
apps/web/                   React + Vite shell (UI only — no chart rendering)
packages/chart-engine/      Imperative, framework-agnostic chart core
packages/indicators/        Pure indicator math, runs on main thread or in a worker
packages/market-data/       Provider-agnostic types + mock provider
packages/paper-trading/     Simulated order book, positions and P&L (no I/O)
services/api/               FastAPI: auth, watchlists, layouts, preferences
docker-compose.yml          Postgres + Redis + API for local/prod-like runs
```

`chart-engine`, `indicators`, `market-data` and `paper-trading` have no dependency on React,
Vite, or the DOM beyond what's strictly needed (a `<canvas>` and a
`Worker`). They could be dropped into a Vue app, a Svelte app, or a plain
script tag with no changes.

## The chart is not a React component

`ChartEngine` (`packages/chart-engine/src/ChartEngine.ts`) is a plain
TypeScript class. `ChartContainer.tsx` mounts exactly one instance in a
`useEffect` with an empty dependency array and never touches it again
through props. Every subsequent mutation — new candles, a tick update, an
indicator being toggled, a theme switch — goes through an imperative method
call (`chart.pushBar(...)`, `chart.setTheme(...)`, ...), not a re-render.

This matters because React's reconciler is not built for 60 Hz mutation of
a few thousand numbers. Putting live market data into `useState` would mean
either the whole component tree re-renders on every tick, or an elaborate
memoization scheme fights the framework the whole way. Skipping React for
the hot path sidesteps the problem entirely.

The chart owns its own `requestAnimationFrame` loop, gated by a dirty flag:
a frame is only drawn when the viewport or data actually changed, so an
idle chart costs nothing.

## Two-layer rendering

A single `<canvas>` can't cheaply mix "draw 2,000 rectangles" with "draw
crisp text at an arbitrary angle." So the chart uses two stacked canvases:

- **WebGL2 canvas** (`render/webgl/`) — candle bodies, wicks, and volume
  bars only. Rendered as **instanced rectangles**: one draw call per shape
  kind (bodies, wicks, volume), regardless of how many candles exist in
  total. The instance buffer only ever holds the *visible* candles, so a
  500,000-candle dataset and a 500-candle dataset cost the same to draw.
- **Canvas2D overlay** (`render/overlay/`) — grid lines, axis labels,
  crosshair, tooltip, drawing tools, and indicator line/histogram overlays.
  Point count here is also bounded by visible width, and Canvas2D handles a
  few thousand `lineTo` calls comfortably inside a 16 ms frame budget.

This is the standard split used by every serious charting library for a
reason: WebGL for bulk uniform geometry, 2D canvas for text and vector
line-work. Neither layer is asked to do the other's job.

## Data layout: structure-of-arrays, not objects

A candle is never an object with six named fields. `CandleStore`
(`packages/chart-engine/src/data/CandleStore.ts`) holds six parallel
`Float64Array`s (time/open/high/low/close/volume) that grow by capacity
doubling (`GrowableFloat64`), so appending a new bar is amortized O(1) with
no per-candle allocation and no garbage-collector pressure. The same shape
(`OHLCVSeriesView`) is what the indicator engine consumes — no conversion
step between "chart data" and "indicator input."

## Indicators: seed once, update in O(1) (or O(period))

`packages/indicators/` implements each indicator (SMA, EMA, WMA, VWAP, RSI,
MACD, ATR, ADX, Supertrend, Bollinger, volume average/spike) as a factory
returning an object with two methods:

- `seed(series)` — one full pass over history, used on initial load or a
  symbol/timeframe switch.
- `update(bar, replacing)` — folds in exactly one bar. `replacing = true`
  means "this is a tick updating the still-forming candle"; `false` means
  "a new candle just closed."

Recursive indicators (EMA, RSI, ATR, MACD, ADX, Supertrend) carry forward
only the previous finalized state (a couple of numbers), so `update` is
O(1) regardless of history length. Window-based indicators (SMA, WMA,
Bollinger, volume average) keep a small `RingBuffer` sized to their period,
so `update` is O(period) — a few hundred operations at most, never O(N).
**The full series is never recomputed on a tick.** This is verified by a
test (`indicators.test.ts`) that seeds N-5 bars, streams the last 5 via
`update`, and asserts the result matches a full recompute over all N bars.

The indicator engine (`IndicatorEngine`) runs inside a dedicated Web
Worker (`apps/web/src/workers/indicatorWorker.ts`) in production, so even
a full 500k-bar `seed()` on a symbol switch can't stall the UI thread. The
main thread mirrors each indicator's output as its own `GrowableFloat64`
buffers and only exchanges single numbers per tick over `postMessage` —
not the whole series — keeping the worker boundary cheap.

## Market data: provider-agnostic, mock-first

`MarketDataProvider` (`packages/market-data/src/types.ts`) is an interface
— `connect/disconnect/subscribe/unsubscribe/getHistoricalCandles/getQuote/
getMarketStatus` — with exactly one implementation today,
`MockMarketDataProvider`. It generates a deterministic (seeded), NSE-hours
-aware (09:15–15:30 IST, weekdays only) random-walk series and simulates a
live tick stream, so the whole app can be built and benchmarked without a
real vendor connection. Swapping in a real NSE/BSE feed later means writing
one new class against the same interface — nothing above it changes.

Historical loads and the live tick stream run in `apps/web/src/workers/
dataWorker.ts`, a separate Web Worker from the indicator worker, so mock
data generation for a 500k-candle benchmark run can't block tick processing
or rendering either.

```
mock provider (or, later, a real vendor)
  -> data worker (candle aggregation, historical batches, tick stream)
  -> DataWorkerClient (main thread, request/response + tick subscription)
  -> ChartEngine.pushBar / .updateLastBar   (renderer)
  -> IndicatorWorkerClient.onBar            (indicator worker, in parallel)
  -> PaperTradingEngine.onPrice             (order matching + mark-to-market)
```

Every mock series for a symbol is scaled to end at one canonical price
(`referencePriceForSymbol`), so the chart, the watchlist quote poll and the
paper book always agree on where that symbol is trading — whichever
timeframe is charted. Without that, a quote poll could seed a symbol far
from the charted price and fill a resting order at a price the market never
traded at. The live tick walk scales through the same
`stepVolatility(dailyVolatility, seconds)` helper as the generator, so a
live bar is the same size as the historical bars beside it.

## Paper trading

`packages/paper-trading` is a plain class with no I/O: the app feeds it
prices, it answers with orders, fills, positions and trades. Keeping fill
semantics there — rather than in a React component — is what lets the same
engine be driven later by a backtest (historical replay) or a strategy
runner, and is why it is unit-testable to the rupee with an injected clock.
See `docs/PAPER_TRADING.md`.

React renders a *snapshot* of the book, refreshed on a 500ms beat for
price-driven changes and immediately for anything that changes the book —
so a tick per second per symbol never turns into a React render per tick.

The chart stays ignorant of trading: `setPriceLines()` takes levels with a
colour, a label and a `draggable` flag, and when one is dragged the engine
emits `priceLineMoved` rather than acting on it. Mapping that back to "modify
this order at this price" is the app's job, which keeps order semantics out
of the renderer and keeps the renderer reusable for alert lines later.

## Panes, viewport and scales

`Viewport` (`viewport/Viewport.ts`) owns the horizontal zoom/pan state
(a fractional "right edge index" + pixels-per-candle) and, per pane, the
active price range and scale transform (linear / log / percentage —
`viewport/scale.ts`). `PaneLayout.ts` splits the plot area's height across
the main price pane, the volume pane, and any enabled separate-pane
indicators (RSI, MACD, ATR, ADX, ...) by weight, so adding an indicator
pane is a layout recomputation, not a special case in the renderer.

## Drawing tools

`DrawingManager` stores each drawing (trend line, ray, rectangle, Fibonacci
retracement/extension, text, arrow, price/date range, ...) anchored in
**data space** (candle index + price), not pixels, so they stay correctly
positioned across pan/zoom without any per-frame recomputation beyond the
same `indexToX`/`priceToY` transform already used for candles.

## Backend: FastAPI, deliberately thin

The API (`services/api/`) owns what a browser tab can't: durable user
accounts, saved watchlists/layouts/preferences. It does **not** own market
data or indicator math — that stays client-side (mock today, a real
provider later) so the chart's performance story never depends on a
network round-trip. SQLAlchemy 2.0 (async, asyncpg) models cover the full
schema described in `docs/DATABASE.md`; only auth, watchlists, chart
layouts and preferences have working endpoints today; scanner/alerts/
strategy/backtest/paper-trading tables exist so those features can be
built against a stable schema without a later migration, but their APIs
are intentionally not stubbed out with fake responses — see
`docs/FUTURE.md`.

## What's explicitly out of scope for Phase 1

- Rust/NATS/Kafka: no clear performance bottleneck justifies them yet
  (TypeScript's incremental-update architecture already keeps the hot path
  cheap). Documented as a future option if a real vendor feed needs
  sub-millisecond tick fan-out.
- A real NSE/BSE vendor integration: requires a paid data agreement; the
  `MarketDataProvider` interface is the seam where it plugs in.
- Options chain, scanner, alerts, strategy builder, backtesting UIs: DB
  schema and architecture are in place; UI/engine implementation is future
  work (see `docs/FUTURE.md`).

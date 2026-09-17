# Future Improvements

Ordered roughly by what naturally follows from what's already built, not
by priority — the user/business priority call is out of scope for this
list.

## Chart engine

- **Multi-chart layouts (2/4-chart grids).** `ChartLayout.layout_type`
  already models `single | 2-chart | 4-chart` and persists per-pane config;
  the frontend only ever mounts one `ChartContainer` today. Needs a grid
  container component that mounts N `ChartEngine` instances and, per the
  spec, optional synchronization of symbol/timeframe/crosshair/date-range
  across panes (a small pub/sub between sibling `ChartEngine`s, not a
  redesign).
- **Compare symbol** (overlay a second symbol's normalized price on the
  same pane) — not implemented.
- **Automated interaction-latency benchmarking.** Today's benchmark panel
  measures load+render time for a data swap; crosshair/zoom/pan latency
  under sustained interaction is only visible live via the dev HUD, not
  captured automatically. A Playwright script driving synthetic mouse
  movement while sampling `chart.getPerfSnapshot()` would close this gap.
- **Persisted drawings/indicators.** `drawing_objects` and `indicators`
  tables exist (`docs/DATABASE.md`) and the client-side shapes already
  match them; nothing currently calls the (not-yet-built) save/load
  endpoints.

## Market data

- **A real NSE/BSE vendor integration**, implementing
  `MarketDataProvider` (`packages/market-data/src/types.ts`) against a
  paid data agreement — the mock provider stays as the offline/dev/
  benchmark path either way.
- **Reconnection, heartbeat, de-duplication, backpressure** — the
  protocol already reserves the fields for this (`Tick.seq`,
  `ConnectionState`); see `docs/WEBSOCKET_PROTOCOL.md` for the specific gap
  list.
- **A real backend WebSocket gateway**, so live data can be shared across
  a user's multiple tabs/devices from one upstream connection instead of
  each browser tab independently simulating its own mock feed.

## India market / F&O

- Option chain, OI/OI-change, PCR, market breadth, advance/decline,
  sector performance — architecturally deferred until a real data source
  provides them (no fabricated values). The DB schema and provider
  interface don't need to change to add these; they're new provider
  methods and new UI panels.

## Scanner, alerts, strategies, backtesting, paper trading

Tables exist (`scanner_rules`, `alerts`, `strategies`, `backtests`,
`paper_trades`); no engines or endpoints yet. Suggested build order, since
each reuses the one before it:

1. **Strategy definition format** — a structured entry/confirmation/exit/
   stop/target/trailing schema (the `Strategy.definition` JSONB shape),
   designed so scanner conditions and alert conditions are literally the
   same condition-expression language.
2. **Scanner engine** — evaluates that condition language against a
   snapshot of candles/indicators for a symbol universe; this is also the
   evaluation core alerts and strategies reuse.
3. **Alert engine** — event-driven (reacts to new bars / condition
   changes), not polling; the same evaluator as the scanner, triggered
   per-symbol on tick/bar events instead of swept across a universe.
4. **Backtest engine** — same evaluator, replayed over historical candles
   with position sizing, brokerage/slippage modeling, and trade-log/
   equity-curve/drawdown/win-rate output into `Backtest.results`.
5. **Paper trading** — the backtest engine's entry/exit logic, driven by
   live data instead of historical replay, writing to `paper_trades`.

Building the UI or API for any of these before the engine exists would
mean an endpoint that writes rows nothing evaluates — deferred
deliberately rather than shipped as a hollow stub.

## Backend

- **Refresh tokens** — today's JWT is a single long-lived access token;
  a refresh-token flow with shorter-lived access tokens is the standard
  next step before this goes anywhere beyond local dev.
- **Redis usage** — provisioned in `docker-compose.yml` but nothing reads
  or writes it yet. Natural first uses: rate-limit state shared across API
  instances (currently in-process via `slowapi`), and a pub/sub fan-out
  point for a future real WebSocket gateway.
- **Audit logging** for sensitive actions (login, preference changes,
  strategy/backtest creation) — structured request logging exists
  (`app/main.py`); a dedicated audit trail for security-relevant actions
  does not yet.
- **Rust/NATS/Kafka.** Nothing in this codebase currently justifies them —
  the incremental-update architecture keeps the TypeScript hot path cheap
  even at 500k candles. Worth revisiting only if a real vendor integration
  turns out to need sub-millisecond multi-consumer tick fan-out that
  Node/Python can't sustain.

## Keyboard shortcuts

The shortcut map (`Alt+1/5/M/D`, `R`, `F`) is hardcoded in `App.tsx`. The
spec calls for it to be user-configurable; that means moving the map into
`user_preferences.keyboard_shortcuts` (already a JSONB column) and reading
it instead of the hardcoded table.

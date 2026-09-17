# Database Schema

PostgreSQL, accessed via SQLAlchemy 2.0 (async, `asyncpg`). Every table has
a UUID primary key (`gen_random_uuid()`-equivalent, generated app-side) and
`created_at`/`updated_at` timestamps where mutation history matters.
Full definitions: `services/api/app/models/*.py`. Migrations:
`services/api/alembic/versions/`.

| Table | Purpose | Key columns / indexes |
|---|---|---|
| `users` | Accounts | unique index on `email` |
| `user_preferences` | Theme, default timeframe, shortcuts (1:1 with `users`) | PK = `user_id` (no separate surrogate key — it's a strict extension of `users`) |
| `watchlists` | Named symbol lists per user | index on `user_id` |
| `watchlist_symbols` | Symbols within a watchlist, ordered | index on `watchlist_id`; unique on `(watchlist_id, symbol)` |
| `chart_layouts` | Saved single/2-chart/4-chart layouts; `config` JSONB holds per-pane symbol/timeframe/scale | index on `user_id` |
| `chart_templates` | Reusable named indicator/drawing-style bundles | index on `user_id` (nullable — a null `user_id` is a system/shared template) |
| `indicators` | Persisted indicator instances attached to a layout/pane | index on `chart_layout_id` |
| `drawing_objects` | Persisted drawings (trend lines, Fibonacci, text, ...) | index on `chart_layout_id` |
| `alerts` | Price/indicator/candle/scanner/strategy alerts | index on `user_id`; index on `status` (alert engine scans active alerts) |
| `scanner_rules` | Saved rule-based scanner definitions | index on `user_id` |
| `strategies` | Structured entry/confirmation/exit/stop/target/trailing definitions | index on `user_id` |
| `backtests` | One backtest run against a strategy; `results` JSONB holds trade log/equity curve/drawdown/win rate/profit factor | index on `strategy_id`, `user_id` |
| `paper_trades` | Simulated executions, optionally tied to a strategy | index on `user_id`; index on `status` |

## Design choices

- **JSONB for genuinely variable-shape data** (layout config, indicator
  params, drawing points, strategy definitions, backtest results). These
  are read/written as whole documents by their owning feature and never
  queried by their internal fields from SQL directly, so normalizing them
  into columns/tables would add relational complexity with no query
  benefit. Everything that *is* queried directly (`user_id`, `status`,
  `symbol`, `watchlist_id`, ...) is a real indexed column.
- **No ORM-level polymorphism.** Alerts, for instance, don't get a
  `price_alerts`/`indicator_alerts`/... table-per-subtype hierarchy; they
  get one `alerts` table with a `condition_type` discriminator and a
  `condition` JSONB payload shaped per type. Only three deployed features
  build queries against alert internals (the alert engine, the alerts UI,
  audit tooling), and none of them need SQL-level filtering *inside* the
  condition — so one table stays simpler than five without losing anything.
- **`ON DELETE CASCADE`** from every child table up to its owning
  `users`/`chart_layouts`/`strategies` row — deleting a user or a layout
  should not orphan rows silently.

## What's schema-ready but not yet API-backed

`indicators`, `drawing_objects`, `alerts`, `scanner_rules`, `strategies`,
`backtests`, and `paper_trades` all have real tables and models today. Only
`watchlists`/`watchlist_symbols`, `chart_layouts`, and `user_preferences`
have working REST endpoints — see `docs/FUTURE.md` for what's left to wire
up. The client-side `IndicatorEngine`/`DrawingManager` already produce data
in exactly the shape these tables expect, so persisting them is additive
work, not a redesign.

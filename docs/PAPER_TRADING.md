# Paper trading

`packages/paper-trading` is a simulated order book and position keeper. It
has no I/O: the app feeds it prices, it answers with orders, fills,
positions and trades. Nothing here ever reaches a broker.

```
app  --onPrice(symbol, price)-->  PaperTradingEngine  --events-->  UI panels
     --placeOrder(...)        -->                     --toJSON()-->  localStorage
```

The same engine is what a backtest runner and a strategy runner should
drive later: a backtest is this engine fed historical closes instead of
live ones, which is why fill semantics live here and not in the UI.

## Order types

| Type   | Behaviour |
| ------ | --------- |
| MARKET | Fills at the next known price. Rejected if no price has arrived for the symbol yet. |
| LIMIT  | Rests until the market trades at or through `limitPrice`. |
| SL     | Stop-limit: on `triggerPrice` it becomes a LIMIT at `limitPrice`. |
| SL-M   | Stop-market: on `triggerPrice` it fills at the triggering price. |

Any MARKET or LIMIT entry can carry a **bracket**: a stop-loss and/or a
target, placed automatically once the entry fills. See below.

Products are `MIS`, `CNC` and `NRML`. They tag positions (MIS and CNC in
the same symbol net separately) but carry **no leverage** — every product
is 1x, because real margin multipliers are broker-specific and are not
invented here.

## Fill semantics

Fills are deliberately conservative — never better than the market:

- MARKET and triggered SL-M fill at the incoming price.
- A LIMIT that the market trades *through* fills at the market price
  (price improvement), not at the limit. A LIMIT that is already
  marketable when placed fills immediately at the market price.
- An SL stays `triggered` but unfilled if the market gaps past both its
  trigger and its limit — the same way a real stop-limit can miss.

Simplifications, all deliberate:

- fills are all-or-nothing: no partial fills, no queue position, no book
  depth (the mock feed has no depth to model)
- no slippage model beyond the above
- charges default to **zero**

## Bracket orders

`placeOrder({ ..., bracket: { stopLossPrice, targetPrice } })` attaches
protective legs to an entry. Once (and only once) the entry fills, the
engine places them in the opposite direction, for the same quantity, in one
OCO group:

- **target** — a LIMIT at `targetPrice`
- **stop-loss** — an SL-M at `stopLossPrice`

The rules that keep a bracket honest:

- The legs are validated against the entry price *before* the entry is
  accepted: a stop on the winning side or a target on the losing side is
  rejected outright, rather than firing the instant it is placed.
- Whichever leg fills first cancels the other. A surviving leg would
  re-open, in the opposite direction, the position it was meant to close.
- Cancelling one leg by hand cancels the whole bracket, as it does at a
  real broker.
- Closing the position any other way — the Exit button, square-off,
  auto-square-off — drops the legs too.
- If the entry fills at a price already through its own stop (a marketable
  limit, say), the stop is placed as a MARKET order and exits immediately:
  that is what the stop was for.

## Intraday auto-square-off

`squareOffProduct("MIS")` cancels resting intraday orders and closes
intraday positions, leaving CNC delivery holdings untouched. The app calls
it once per trading day, on a 30-second check, when the IST clock passes the
session close — `shouldSquareOffIntraday()` in `session.ts` decides, and it
computes IST from epoch milliseconds rather than the machine's timezone, so
a laptop on UTC behaves the same as one in India.

The default cut-off is the exchange close, 15:30 IST. Real brokers square
off earlier (typically 15:15–15:20) and differ from each other, so that
policy is a parameter (`atIstMinutes`) rather than a hardcoded guess.
Exchange holidays are not modelled: there is no holiday calendar here to be
wrong about, so only weekends are excluded.

## Validation and funds

An order is rejected, with a reason shown on the ticket, when:

- quantity is not a positive whole number
- a LIMIT/SL has no limit price, or an SL/SL-M has no trigger price
- a stop is placed already through the market (a BUY stop at or below the
  last price, a SELL stop at or above it) — real brokers reject these too
- it needs more funds than are available

Funds are tracked at 1x:

```
cash               = startingBalance + realizedPnl        (realized is net of charges)
usedMargin         = Σ |quantity| × averagePrice          (open positions)
availableBalance   = cash − usedMargin − margin blocked by resting orders
equity             = startingBalance + realizedPnl + unrealizedPnl
```

An order that only *reduces* an open position blocks no margin.

## Positions and trades

Positions are netted per `symbol + product`, with a signed quantity
(negative is short). A fill in the opposite direction closes up to the
open quantity and, if it is larger, reverses into a new position at the
fill price.

Every reducing fill books a `Trade` — entry price, exit price, quantity,
P&L net of the charges attributed to that exit. That shape matches the
`paper_trades` table in `docs/DATABASE.md`, so persisting the trade log
server-side later is a write, not a redesign.

## Charges

`createSimpleChargesModel({ perOrder, percentOfTurnover, maxPerOrder })`
applies a flat and/or turnover fee, with every rate supplied by the caller
and defaulting to zero. Real brokerage, STT, exchange transaction, SEBI,
stamp-duty and GST rates differ by broker, segment and state, so none are
hardcoded — feed the model your broker's published numbers to see P&L net
of costs.

## Where prices come from

The engine matches only on prices it is actually given:

- the **charted symbol** is driven by the live tick stream (1/second)
- **every other watchlist symbol** is driven by the quote poll (1/3s)

A symbol nobody is watching gets no prices, so its resting orders simply
never trigger — nothing fills against a stale or invented price. All of
these come from one coherent per-symbol price in the mock provider: every
generated series for a symbol is scaled to end at the same canonical
price (`referencePriceForSymbol`), so the chart, the watchlist and the
paper book cannot disagree about where the market is. Before that was
true, a quote poll could seed a symbol ~8% away from the charted price and
fill a resting order at a price the market never traded at.

The live walk is also scaled to the *same* daily volatility as the
historical generator, through one shared helper, and by elapsed wall-clock
time rather than per call. Before that, live bars were ~22x the size of the
historical ones: stops and targets triggered on moves the simulated market
should never have made in five minutes, and the chart flattened (see
`docs/TESTING.md`).

## Persistence

The book is persisted to `localStorage` under
`trading-master.paper-book.v1` — orders, positions, trades, last prices and
realized P&L — and restored on load, so a reload does not wipe the day.
It is per-browser: there is no server-side paper book yet (see
`docs/FUTURE.md`).

## UI

- **Order ticket** (side panel) — side, quantity, product, type, limit and
  trigger, an optional bracket (stop-loss + target, seeded 1% either side of
  the market), with live LTP, order value, available funds, and the fill or
  rejection reason.
- **Trading dock** (under the chart) — Positions / Orders / Trades tabs,
  plus P&L, realised, unrealised, available and equity, and "square off
  all". Collapsible.
- **Chart price lines** — position entry (solid, green long / red short,
  labelled `LONG 25`) and resting orders (dashed, labelled `B LIMIT`, `SL`,
  `TARGET`), for the charted symbol. A level outside the visible price range
  is not silently dropped: its label pins to the edge it went past, dimmed
  and with an arrow, so an off-screen stop is still visible.
- **Drag to modify** — drag a resting order's line to a new price and the
  order is modified there (snapped to the 5-paise NSE tick). The cursor
  turns to `ns-resize` over a draggable line. Position lines are a record of
  a fill, so they are not draggable. The chart never applies the move
  itself: it reports `priceLineMoved` and the app decides what moving that
  line means.

## Tests

`npm run test -w packages/paper-trading` — 46 tests covering fill
semantics for all four order types, netting (average-up, partial exit,
close, reverse), MIS/CNC separation, short P&L, funds blocking and
rejection, charges, cancel/modify, square-off, event ordering and
JSON round-tripping, plus brackets (leg placement, both OCO directions,
manual cancel, exit-by-other-means, rejection of legs on the wrong side, an
entry that fills already through its stop) and IST session arithmetic. The
engine takes injectable `now()` and `idFactory()`, so the tests are
deterministic — no clock, no randomness.

The price-line hit test is a pure function
(`findDraggablePriceLine` in `packages/chart-engine`) with its own 6 tests,
so the grab-distance and closest-line rules are verified without a DOM. The
drag itself is verified in the browser (`docs/TESTING.md`).

# Market-Data Protocol

There is no network WebSocket yet — Phase 1's mock provider runs entirely
in-browser via Web Workers (`apps/web/src/workers/dataWorker.ts`), which was
an explicit goal ("develop and benchmark the chart independently of a live
market-data provider"). This document specifies the **message protocol**
the frontend already speaks internally, so that a future real backend
WebSocket gateway is a drop-in replacement: same message shapes, same event
flow, just a `WebSocket` instead of a `Worker` on the other end.

## Why this shape

```
provider -> gateway -> normalization -> tick processing -> candle aggregation -> transport -> chart
```

The mock provider today plays the role of everything left of "transport."
Swapping in a real NSE/BSE vendor means writing a new `MarketDataProvider`
(`packages/market-data/src/types.ts`) and a real WebSocket gateway that
speaks the same message shapes below — the chart, the indicator worker, and
the rest of the frontend do not change.

## Client -> server messages

Mirrors `apps/web/src/workers/dataProtocol.ts` (`DataWorkerRequest`), which
would become actual WebSocket frames (JSON) in a networked version:

```ts
{ kind: "loadHistory", requestId, symbol, timeframe, count }
{ kind: "loadMore", requestId, symbol, timeframe, beforeTime, count }
{ kind: "subscribeLive", symbol, timeframe }
{ kind: "unsubscribeLive", symbol, timeframe }
{ kind: "getQuote", requestId, symbol }
{ kind: "getMarketStatus", requestId }
```

## Server -> client messages

```ts
{ kind: "history", requestId, batch: CandleBatch }
{ kind: "tick", symbol, timeframe, candle: CandleSnapshot, isFinal }
{ kind: "quote", requestId, quote: Quote }
{ kind: "marketStatus", requestId, status: MarketStatus }
```

`isFinal: true` marks a bar that just closed (the aggregator moved to a new
bucket); `isFinal: false` is a live update to the still-forming bar. The
frontend actually derives "did a new bar start" itself by comparing
`candle.time` to the last known bar time (see `App.tsx`'s tick handler) — a
real gateway does not need to get this exactly right either, since the
client is tolerant of either the aggregator's own final/non-final framing
or a raw tick stream the client aggregates itself.

## What a real gateway must add

- **Heartbeat / connection state.** `ConnectionState` (`connecting |
  connected | disconnected | reconnecting`) is already defined in
  `packages/market-data/src/types.ts` as a `MarketDataProvider` contract
  member; a real provider should transition through it and the frontend
  should surface it (not built yet — see `docs/FUTURE.md`).
- **Reconnection with backfill.** On reconnect, the client must call
  `getHistoricalCandles` for the gap between "last candle it has" and "now"
  before resuming live ticks, to avoid a silent hole in the series.
- **De-duplication and ordering.** `Tick.seq` (a monotonically increasing
  gateway-assigned sequence number, already in the type) is reserved for
  this: a real gateway should assign it, and the client should drop any
  tick whose `seq` is not greater than the last one seen per symbol, and
  buffer/reorder briefly if a lower `seq` arrives out of order.
- **Backpressure.** If tick volume outpaces the client (e.g. an inactive
  background tab), the gateway should coalesce to the latest tick per
  symbol rather than queueing unboundedly — the client only ever needs the
  most recent price for the still-forming candle.
- **One connection, many subscriptions.** The mock provider already
  supports multiple `subscribe(symbol, timeframe, listener)` calls over one
  provider instance; a real gateway should multiplex the same way over one
  socket rather than one connection per symbol.

None of this is fabricated as if it already works — the mock provider does
not reconnect, dedupe, or reorder, because it never disconnects or reorders
in the first place. This section is the honest gap list for the real
integration.

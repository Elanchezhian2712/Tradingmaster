/// <reference lib="webworker" />
import { generateMockCandles, hashSeedFromSymbol, MockMarketDataProvider, referencePriceForSymbol } from "@trading-master/market-data";
import { DataWorkerRequest, DataWorkerResponse } from "./dataProtocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const provider = new MockMarketDataProvider();
void provider.connect();
const unsubscribers = new Map<string, () => void>();

function post(msg: DataWorkerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

ctx.onmessage = (event: MessageEvent<DataWorkerRequest>) => {
  const req = event.data;

  switch (req.kind) {
    case "loadHistory": {
      const seed = hashSeedFromSymbol(req.symbol);
      // Every timeframe for a symbol ends at the same canonical price, so
      // switching timeframe does not teleport the market.
      const batch = generateMockCandles(req.timeframe, req.count, {
        seed,
        endPrice: referencePriceForSymbol(req.symbol),
      });
      // Anchor the live stream to where this series ends, before the buffers are
      // transferred (posting detaches them).
      const lastClose = batch.close.length > 0 ? batch.close[batch.close.length - 1]! : undefined;
      if (lastClose !== undefined) provider.setReferencePrice(req.symbol, lastClose);
      post(
        { kind: "history", requestId: req.requestId, batch },
        [batch.time.buffer, batch.open.buffer, batch.high.buffer, batch.low.buffer, batch.close.buffer, batch.volume.buffer]
      );
      break;
    }
    case "loadMore": {
      const seed = hashSeedFromSymbol(req.symbol);
      // `endPrice` makes the older chunk finish where the loaded series begins,
      // so a prepend joins without a price gap at the seam.
      const batch = generateMockCandles(req.timeframe, req.count, {
        seed,
        endTime: req.beforeTime,
        ...(req.endPrice !== undefined ? { endPrice: req.endPrice } : {}),
      });
      post(
        { kind: "history", requestId: req.requestId, batch },
        [batch.time.buffer, batch.open.buffer, batch.high.buffer, batch.low.buffer, batch.close.buffer, batch.volume.buffer]
      );
      break;
    }
    case "subscribeLive": {
      const key = `${req.symbol}:${req.timeframe}`;
      if (unsubscribers.has(key)) break;
      const unsubscribe = provider.subscribe(req.symbol, req.timeframe, (event) => {
        if (event.type !== "candle-update") return;
        post({
          kind: "tick",
          symbol: event.symbol,
          timeframe: event.timeframe,
          candle: event.candle,
          isFinal: event.isFinal,
        });
      });
      unsubscribers.set(key, unsubscribe);
      break;
    }
    case "unsubscribeLive": {
      const key = `${req.symbol}:${req.timeframe}`;
      unsubscribers.get(key)?.();
      unsubscribers.delete(key);
      break;
    }
    case "getQuote": {
      provider.getQuote(req.symbol).then((quote) => post({ kind: "quote", requestId: req.requestId, quote }));
      break;
    }
    case "getMarketStatus": {
      provider.getMarketStatus("NSE").then((status) => post({ kind: "marketStatus", requestId: req.requestId, status }));
      break;
    }
  }
};

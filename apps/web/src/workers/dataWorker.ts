/// <reference lib="webworker" />
import { generateMockCandles, hashSeedFromSymbol, MockMarketDataProvider } from "@trading-master/market-data";
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
      const batch = generateMockCandles(req.timeframe, req.count, { seed });
      post(
        { kind: "history", requestId: req.requestId, batch },
        [batch.time.buffer, batch.open.buffer, batch.high.buffer, batch.low.buffer, batch.close.buffer, batch.volume.buffer]
      );
      break;
    }
    case "loadMore": {
      const seed = hashSeedFromSymbol(req.symbol);
      const batch = generateMockCandles(req.timeframe, req.count, { seed, endTime: req.beforeTime });
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

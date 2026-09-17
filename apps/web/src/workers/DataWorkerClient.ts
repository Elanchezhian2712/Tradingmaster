import { CandleBatch, MarketStatus, Quote, Timeframe } from "@trading-master/market-data";
import { CandleSnapshotMsg, DataWorkerRequest, DataWorkerResponse } from "./dataProtocol";

type TickListener = (symbol: string, timeframe: Timeframe, candle: CandleSnapshotMsg, isFinal: boolean) => void;

/** Main-thread handle to the mock market-data Web Worker: historical loads, live tick subscriptions, quotes. */
export class DataWorkerClient {
  private worker: Worker;
  private requestId = 0;
  private pending = new Map<number, (msg: DataWorkerResponse) => void>();
  private tickListeners = new Set<TickListener>();

  constructor() {
    this.worker = new Worker(new URL("./dataWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<DataWorkerResponse>) => this.handleMessage(event.data);
    this.worker.onerror = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error("[dataWorker] uncaught error", event.message, event.filename, event.lineno);
    };
  }

  private handleMessage(msg: DataWorkerResponse): void {
    if (msg.kind === "tick") {
      for (const l of this.tickListeners) l(msg.symbol, msg.timeframe, msg.candle, msg.isFinal);
      return;
    }
    const resolver = this.pending.get(msg.requestId);
    if (resolver) {
      this.pending.delete(msg.requestId);
      resolver(msg);
    }
  }

  private nextRequestId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  loadHistory(symbol: string, timeframe: Timeframe, count: number): Promise<CandleBatch> {
    const requestId = this.nextRequestId();
    const req: DataWorkerRequest = { kind: "loadHistory", requestId, symbol, timeframe, count };
    return new Promise((resolve) => {
      this.pending.set(requestId, (msg) => {
        if (msg.kind === "history") resolve(msg.batch);
      });
      this.worker.postMessage(req);
    });
  }

  /** `endPrice` is the oldest loaded bar's open, so the older chunk joins it without a gap. */
  loadMore(symbol: string, timeframe: Timeframe, beforeTime: number, count: number, endPrice?: number): Promise<CandleBatch> {
    const requestId = this.nextRequestId();
    const req: DataWorkerRequest = { kind: "loadMore", requestId, symbol, timeframe, beforeTime, count, endPrice };
    return new Promise((resolve) => {
      this.pending.set(requestId, (msg) => {
        if (msg.kind === "history") resolve(msg.batch);
      });
      this.worker.postMessage(req);
    });
  }

  getQuote(symbol: string): Promise<Quote> {
    const requestId = this.nextRequestId();
    const req: DataWorkerRequest = { kind: "getQuote", requestId, symbol };
    return new Promise((resolve) => {
      this.pending.set(requestId, (msg) => {
        if (msg.kind === "quote") resolve(msg.quote);
      });
      this.worker.postMessage(req);
    });
  }

  getMarketStatus(): Promise<MarketStatus> {
    const requestId = this.nextRequestId();
    const req: DataWorkerRequest = { kind: "getMarketStatus", requestId };
    return new Promise((resolve) => {
      this.pending.set(requestId, (msg) => {
        if (msg.kind === "marketStatus") resolve(msg.status);
      });
      this.worker.postMessage(req);
    });
  }

  subscribeLive(symbol: string, timeframe: Timeframe): void {
    this.worker.postMessage({ kind: "subscribeLive", symbol, timeframe } satisfies DataWorkerRequest);
  }

  unsubscribeLive(symbol: string, timeframe: Timeframe): void {
    this.worker.postMessage({ kind: "unsubscribeLive", symbol, timeframe } satisfies DataWorkerRequest);
  }

  onTick(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  dispose(): void {
    this.worker.terminate();
  }
}

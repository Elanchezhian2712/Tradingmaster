import { CandleAggregator } from "./aggregation";
import { generateMockCandles } from "./mockGenerator";
import {
  CandleBatch,
  ConnectionState,
  Exchange,
  HistoricalCandlesRequest,
  MarketDataListener,
  MarketDataProvider,
  MarketStatus,
  Quote,
  TIMEFRAME_SECONDS,
  Timeframe,
  Tick,
} from "./types";

interface Subscription {
  symbol: string;
  timeframe: Timeframe;
  listeners: Set<MarketDataListener>;
  aggregator: CandleAggregator;
  timer: ReturnType<typeof setInterval> | null;
  seq: number;
}

function key(symbol: string, timeframe: Timeframe): string {
  return `${symbol}:${timeframe}`;
}

/**
 * Fully self-contained mock provider: no network calls. Generates a
 * deterministic historical series per symbol and simulates a live tick
 * stream so the whole app (chart, watchlist, alerts) can be developed
 * and benchmarked without a real broker/vendor connection.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  private subs = new Map<string, Subscription>();
  private lastPrice = new Map<string, number>();
  private _connectionState: ConnectionState = "disconnected";
  private tickIntervalMs = 1000;

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  async connect(): Promise<void> {
    this._connectionState = "connecting";
    await new Promise((r) => setTimeout(r, 50));
    this._connectionState = "connected";
  }

  async disconnect(): Promise<void> {
    for (const sub of this.subs.values()) {
      if (sub.timer) clearInterval(sub.timer);
    }
    this.subs.clear();
    this._connectionState = "disconnected";
  }

  subscribe(symbol: string, timeframe: Timeframe, listener: MarketDataListener): () => void {
    const k = key(symbol, timeframe);
    let sub = this.subs.get(k);
    if (!sub) {
      sub = {
        symbol,
        timeframe,
        listeners: new Set(),
        aggregator: new CandleAggregator(timeframe),
        timer: null,
        seq: 0,
      };
      this.subs.set(k, sub);
      sub.timer = setInterval(() => this.tick(sub!), this.tickIntervalMs);
    }
    sub.listeners.add(listener);
    return () => {
      sub!.listeners.delete(listener);
      if (sub!.listeners.size === 0) {
        if (sub!.timer) clearInterval(sub!.timer);
        this.subs.delete(k);
      }
    };
  }

  unsubscribe(symbol: string, timeframe: Timeframe): void {
    const k = key(symbol, timeframe);
    const sub = this.subs.get(k);
    if (sub?.timer) clearInterval(sub.timer);
    this.subs.delete(k);
  }

  private tick(sub: Subscription): void {
    const prev = this.lastPrice.get(sub.symbol) ?? 1000 + Math.random() * 2000;
    const changeFrac = (Math.random() - 0.5) * 0.004;
    const price = Math.max(0.05, prev * (1 + changeFrac));
    this.lastPrice.set(sub.symbol, price);

    const tick: Tick = {
      symbol: sub.symbol,
      price,
      size: Math.round(1 + Math.random() * 500),
      timestamp: Date.now(),
      seq: sub.seq++,
    };

    for (const l of sub.listeners) l({ type: "tick", tick });

    const { candle, closedPrevious } = sub.aggregator.ingest(tick);
    if (closedPrevious) {
      for (const l of sub.listeners) {
        l({ type: "candle-update", symbol: sub.symbol, timeframe: sub.timeframe, candle: closedPrevious, isFinal: true });
      }
    }
    for (const l of sub.listeners) {
      l({ type: "candle-update", symbol: sub.symbol, timeframe: sub.timeframe, candle, isFinal: false });
    }
  }

  async getHistoricalCandles(req: HistoricalCandlesRequest): Promise<CandleBatch> {
    const { symbol, timeframe, from, to } = req;
    const seed = hashSeedFromSymbol(symbol);
    const approxSeconds = Math.max(1, to - from);
    const tfSeconds = TIMEFRAME_SECONDS[timeframe];
    const estimatedCount = Math.min(1_000_000, Math.ceil(approxSeconds / tfSeconds) + 2);
    const batch = generateMockCandles(timeframe, estimatedCount, { seed, endTime: to });

    let startIdx = 0;
    while (startIdx < batch.time.length && batch.time[startIdx]! < from) startIdx++;
    if (startIdx === 0) return batch;

    return sliceBatch(batch, startIdx, batch.time.length);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const price = this.lastPrice.get(symbol) ?? 1000 + Math.random() * 2000;
    const prevClose = price * (1 - (Math.random() - 0.5) * 0.02);
    const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, price) * (1 + Math.random() * 0.005);
    const low = Math.min(open, price) * (1 - Math.random() * 0.005);
    return {
      symbol,
      ltp: price,
      open,
      high,
      low,
      close: price,
      prevClose,
      volume: Math.round(100_000 + Math.random() * 5_000_000),
      change: price - prevClose,
      changePercent: ((price - prevClose) / prevClose) * 100,
      timestamp: Date.now(),
    };
  }

  async getMarketStatus(exchange: Exchange): Promise<MarketStatus> {
    const now = new Date();
    const istMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
    const day = new Date(now.getTime() + 330 * 60 * 1000).getUTCDay();
    const isWeekday = day >= 1 && day <= 5;
    const inSession = istMinutes >= 9 * 60 + 15 && istMinutes <= 15 * 60 + 30;
    return {
      exchange,
      status: isWeekday && inSession ? "OPEN" : "CLOSED",
    };
  }
}

export function hashSeedFromSymbol(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sliceBatch(batch: CandleBatch, start: number, end: number): CandleBatch {
  return {
    time: batch.time.slice(start, end),
    open: batch.open.slice(start, end),
    high: batch.high.slice(start, end),
    low: batch.low.slice(start, end),
    close: batch.close.slice(start, end),
    volume: batch.volume.slice(start, end),
  };
}

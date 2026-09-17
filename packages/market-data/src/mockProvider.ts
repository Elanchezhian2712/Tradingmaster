import { CandleAggregator } from "./aggregation";
import {
  DEFAULT_DAILY_VOLATILITY,
  gaussianRandom,
  generateMockCandles,
  referencePriceForSeed,
  stepVolatility,
} from "./mockGenerator";
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

/** Per-symbol session statistics, accumulated from the simulated prices actually emitted. */
interface QuoteState {
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

/** Floor on a step, so a burst of calls in the same millisecond still moves the price a little. */
const MIN_STEP_SECONDS = 0.05;
/**
 * Ceiling on a step. A tab left in the background for an hour should not come
 * back to an hour-sized single jump — the simulated market catches up gently.
 */
const MAX_STEP_SECONDS = 300;

export interface MockMarketDataProviderOptions {
  /** Daily volatility of the simulated walk. Defaults to the historical generator's. */
  dailyVolatility?: number;
  /** Injectable for deterministic tests. */
  now?: () => number;
  /** Injectable for deterministic tests. */
  random?: () => number;
  tickIntervalMs?: number;
}

function key(symbol: string, timeframe: Timeframe): string {
  return `${symbol}:${timeframe}`;
}

/**
 * Fully self-contained mock provider: no network calls. Generates a
 * deterministic historical series per symbol and simulates a live tick
 * stream so the whole app (chart, watchlist, paper trading) can be developed
 * and benchmarked without a real broker/vendor connection.
 *
 * One price per symbol drives everything — ticks, candle updates and quotes
 * all walk the same number, so a position opened from the watchlist is valued
 * against the same series the chart draws.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  private subs = new Map<string, Subscription>();
  private lastPrice = new Map<string, number>();
  private lastPriceAt = new Map<string, number>();
  private quoteState = new Map<string, QuoteState>();
  private _connectionState: ConnectionState = "disconnected";
  private readonly tickIntervalMs: number;
  private readonly dailyVolatility: number;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(options: MockMarketDataProviderOptions = {}) {
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;
    this.dailyVolatility = options.dailyVolatility ?? DEFAULT_DAILY_VOLATILITY;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
  }

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

  /**
   * Anchor a symbol's live price to a known value — the caller passes the last
   * close of the historical series it just loaded, so the live stream continues
   * from where the chart ends instead of teleporting to an unrelated price.
   *
   * Mock-only: a real provider's prices come from the exchange, not the client.
   */
  setReferencePrice(symbol: string, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.lastPrice.set(symbol, price);
    this.lastPriceAt.set(symbol, this.now());
    this.quoteState.set(symbol, {
      prevClose: price,
      open: price,
      high: price,
      low: price,
      volume: 0,
    });
  }

  /** Current simulated price, seeded deterministically from the symbol on first use. */
  private priceOf(symbol: string): number {
    const existing = this.lastPrice.get(symbol);
    if (existing !== undefined) return existing;
    const seeded = referencePriceForSymbol(symbol);
    this.lastPrice.set(symbol, seeded);
    return seeded;
  }

  private stateOf(symbol: string): QuoteState {
    const existing = this.quoteState.get(symbol);
    if (existing) return existing;
    const price = this.priceOf(symbol);
    const state: QuoteState = { prevClose: price, open: price, high: price, low: price, volume: 0 };
    this.quoteState.set(symbol, state);
    return state;
  }

  /**
   * Advance a symbol along the random walk by however much wall-clock time has
   * passed, and fold the new price into its session stats.
   *
   * The step is scaled by elapsed time through the same `stepVolatility` the
   * historical generator uses, so live bars come out the same size as the
   * historical bars beside them however often the price is polled — a 3-second
   * quote poll moves it by sqrt(3) more than a 1-second tick, and two callers
   * polling the same symbol do not double its volatility.
   */
  private advancePrice(symbol: string, size: number): number {
    const prev = this.priceOf(symbol);
    const now = this.now();
    const previousAt = this.lastPriceAt.get(symbol);
    const elapsedSeconds = previousAt === undefined ? this.tickIntervalMs / 1000 : (now - previousAt) / 1000;
    const dt = Math.min(MAX_STEP_SECONDS, Math.max(MIN_STEP_SECONDS, elapsedSeconds));

    const price = Math.max(0.05, prev * (1 + gaussianRandom(this.random) * stepVolatility(this.dailyVolatility, dt)));
    this.lastPrice.set(symbol, price);
    this.lastPriceAt.set(symbol, now);

    const state = this.stateOf(symbol);
    state.high = Math.max(state.high, price);
    state.low = Math.min(state.low, price);
    state.volume += size;
    return price;
  }

  private tick(sub: Subscription): void {
    const size = Math.round(1 + this.random() * 500);
    const price = this.advancePrice(sub.symbol, size);

    const tick: Tick = {
      symbol: sub.symbol,
      price,
      size,
      timestamp: this.now(),
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
    const batch = generateMockCandles(timeframe, estimatedCount, {
      seed,
      endTime: to,
      endPrice: referencePriceForSymbol(symbol),
    });

    let startIdx = 0;
    while (startIdx < batch.time.length && batch.time[startIdx]! < from) startIdx++;
    if (startIdx === 0) return batch;

    return sliceBatch(batch, startIdx, batch.time.length);
  }

  /**
   * Quotes walk the same price as the tick stream, so polling a symbol that is
   * not subscribed still produces a continuous series rather than a fresh
   * random number on every poll.
   */
  async getQuote(symbol: string): Promise<Quote> {
    const price = this.advancePrice(symbol, Math.round(1 + this.random() * 500));
    const state = this.stateOf(symbol);
    return {
      symbol,
      ltp: price,
      open: state.open,
      high: state.high,
      low: state.low,
      close: price,
      prevClose: state.prevClose,
      volume: state.volume,
      change: price - state.prevClose,
      changePercent: ((price - state.prevClose) / state.prevClose) * 100,
      timestamp: this.now(),
    };
  }

  async getMarketStatus(exchange: Exchange): Promise<MarketStatus> {
    const now = new Date(this.now());
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

/**
 * The price every mock series for this symbol ends at, and the level its
 * quotes start from. Deterministic, so the chart, the watchlist and the paper
 * book all value a symbol the same way.
 */
export function referencePriceForSymbol(symbol: string): number {
  return referencePriceForSeed(hashSeedFromSymbol(symbol));
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

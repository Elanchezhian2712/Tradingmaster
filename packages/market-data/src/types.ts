/**
 * Core market-data types shared by every provider implementation
 * (mock, and later real NSE/BSE vendors). Nothing here may assume
 * a specific broker or vendor payload shape.
 */

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1H"
  | "4H"
  | "1D"
  | "1W"
  | "1M";

/** Timeframe duration in seconds. "1M" (calendar month) is approximated at 30d for bucketing math only. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "1W": 604800,
  "1M": 2592000,
};

export type Exchange = "NSE" | "BSE";

export type SegmentType = "EQ" | "FUT" | "OPT" | "INDEX";

export interface SymbolMeta {
  symbol: string;
  exchange: Exchange;
  segment: SegmentType;
  name: string;
  lotSize?: number;
  tickSize: number;
  /** Only present for derivatives */
  expiry?: string;
  strike?: number;
  optionType?: "CE" | "PE";
}

/** A single normalized trade tick coming off the market-data gateway. */
export interface Tick {
  symbol: string;
  price: number;
  size: number;
  /** Epoch milliseconds, exchange time where available. */
  timestamp: number;
  /** Monotonically increasing sequence id from the gateway, used for de-duplication and ordering. */
  seq: number;
}

export interface Quote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export type MarketStatusValue = "PRE_OPEN" | "OPEN" | "CLOSED" | "HALTED";

export interface MarketStatus {
  exchange: Exchange;
  status: MarketStatusValue;
  /** Epoch ms of next session boundary, if known. */
  nextTransition?: number;
}

/**
 * Structure-of-arrays candle batch. Using parallel typed arrays instead of
 * an array of objects avoids per-candle allocations and keeps the data
 * transferable across worker boundaries with zero copy.
 */
export interface CandleBatch {
  /** Unix seconds, ascending, one per candle. */
  time: Float64Array;
  open: Float64Array;
  high: Float64Array;
  low: Float64Array;
  close: Float64Array;
  volume: Float64Array;
}

export function createCandleBatch(length: number): CandleBatch {
  return {
    time: new Float64Array(length),
    open: new Float64Array(length),
    high: new Float64Array(length),
    low: new Float64Array(length),
    close: new Float64Array(length),
    volume: new Float64Array(length),
  };
}

export interface HistoricalCandlesRequest {
  symbol: string;
  timeframe: Timeframe;
  /** Unix seconds, inclusive range. */
  from: number;
  to: number;
}

export type MarketDataEvent =
  | { type: "tick"; tick: Tick }
  | { type: "candle-update"; symbol: string; timeframe: Timeframe; candle: CandleSnapshot; isFinal: boolean }
  | { type: "quote"; quote: Quote }
  | { type: "market-status"; status: MarketStatus }
  | { type: "connection-state"; state: ConnectionState };

export interface CandleSnapshot {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export type MarketDataListener = (event: MarketDataEvent) => void;

/**
 * Provider-agnostic interface. A real NSE/BSE vendor integration and the
 * mock provider both implement this so the rest of the app never depends
 * on a concrete vendor.
 */
export interface MarketDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(symbol: string, timeframe: Timeframe, listener: MarketDataListener): () => void;
  unsubscribe(symbol: string, timeframe: Timeframe): void;
  getHistoricalCandles(req: HistoricalCandlesRequest): Promise<CandleBatch>;
  getQuote(symbol: string): Promise<Quote>;
  getMarketStatus(exchange: Exchange): Promise<MarketStatus>;
  readonly connectionState: ConnectionState;
}

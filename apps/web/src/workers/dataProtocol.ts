import { CandleBatch, MarketStatus, Quote, Timeframe } from "@trading-master/market-data";

export type DataWorkerRequest =
  | { kind: "loadHistory"; requestId: number; symbol: string; timeframe: Timeframe; count: number }
  | {
      kind: "loadMore";
      requestId: number;
      symbol: string;
      timeframe: Timeframe;
      beforeTime: number;
      count: number;
      /** Price the older chunk should end at — the oldest loaded bar's open, so the seam is continuous. */
      endPrice?: number;
    }
  | { kind: "subscribeLive"; symbol: string; timeframe: Timeframe }
  | { kind: "unsubscribeLive"; symbol: string; timeframe: Timeframe }
  | { kind: "getQuote"; requestId: number; symbol: string }
  | { kind: "getMarketStatus"; requestId: number };

export type DataWorkerResponse =
  | { kind: "history"; requestId: number; batch: CandleBatch }
  | { kind: "tick"; symbol: string; timeframe: Timeframe; candle: CandleSnapshotMsg; isFinal: boolean }
  | { kind: "quote"; requestId: number; quote: Quote }
  | { kind: "marketStatus"; requestId: number; status: MarketStatus };

export interface CandleSnapshotMsg {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

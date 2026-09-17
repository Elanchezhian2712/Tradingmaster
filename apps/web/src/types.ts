import { IndicatorType } from "@trading-master/indicators";

export interface ActiveIndicator {
  id: string;
  type: IndicatorType;
  label: string;
  params: Record<string, number>;
  enabled: boolean;
}

export interface WatchlistQuoteRow {
  symbol: string;
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

export interface WatchlistDef {
  id: string;
  name: string;
  symbols: string[];
}

/** Structurally compatible with @trading-master/market-data's CandleBatch, without a hard dependency. */
export interface OHLCVSeriesView {
  time: Float64Array;
  open: Float64Array;
  high: Float64Array;
  low: Float64Array;
  close: Float64Array;
  volume: Float64Array;
  length: number;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorOutput = Record<string, Float64Array>;

export type PaneKind = "overlay" | "separate";

/**
 * One running instance of an indicator (e.g. "EMA 21 on close"). Holds its
 * own rolling state so a new/updated bar can be folded in without touching
 * the rest of the series.
 */
export interface IndicatorInstance {
  readonly id: string;
  readonly type: IndicatorType;
  readonly keys: string[];
  readonly pane: PaneKind;
  params: Record<string, number>;

  /** Full recompute over the whole series; also primes rolling state to the last bar. */
  seed(series: OHLCVSeriesView): IndicatorOutput;

  /**
   * Folds one bar in. `replacing = true` means this bar overwrites the
   * still-forming last bar (a live tick update); `false` means it is a
   * newly closed bar appended after the last one.
   */
  update(bar: OHLCVBar, replacing: boolean): Record<string, number>;
}

export type IndicatorType =
  | "SMA"
  | "EMA"
  | "WMA"
  | "VWAP"
  | "RSI"
  | "MACD"
  | "ATR"
  | "ADX"
  | "SUPERTREND"
  | "BOLLINGER"
  | "VOLUME_AVERAGE"
  | "VOLUME_SPIKE";

export const DEFAULT_PANE: Record<IndicatorType, PaneKind> = {
  SMA: "overlay",
  EMA: "overlay",
  WMA: "overlay",
  VWAP: "overlay",
  BOLLINGER: "overlay",
  SUPERTREND: "overlay",
  RSI: "separate",
  MACD: "separate",
  ATR: "separate",
  ADX: "separate",
  VOLUME_AVERAGE: "separate",
  VOLUME_SPIKE: "separate",
};

import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function trueRange(high: number, low: number, prevClose: number): number {
  if (Number.isNaN(prevClose)) return high - low;
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

interface ATRCore {
  out: Float64Array;
  atr: number;
}

export function atrCore(series: OHLCVSeriesView, period: number): ATRCore {
  const n = series.length;
  const out = new Float64Array(n).fill(NaN);
  if (n <= period) return { out, atr: NaN };

  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);
  }
  let atr = sum / period;
  out[period] = atr;

  for (let i = period + 1; i < n; i++) {
    const tr = trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);
    atr = (atr * (period - 1) + tr) / period;
    out[i] = atr;
  }
  return { out, atr };
}

export function computeATR(series: OHLCVSeriesView, period: number): Float64Array {
  return atrCore(series, period).out;
}

/** O(1) incremental ATR using Wilder's smoothing recurrence. */
export function createATR(id: string, period: number): IndicatorInstance {
  let prevAtr = NaN;
  let prevClose = NaN;
  let lastFinalClose = NaN;
  let seenBars = 0;

  return {
    id,
    type: "ATR",
    keys: ["atr"],
    pane: "separate",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const { out, atr } = atrCore(series, period);
      prevAtr = atr;
      lastFinalClose = series.close[series.length - 1] ?? NaN;
      prevClose = series.close[series.length - 2] ?? NaN;
      seenBars = series.length;
      return { atr: out };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      const basePrevClose = replacing ? prevClose : lastFinalClose;
      const tr = trueRange(bar.high, bar.low, basePrevClose);

      let value: number;
      if (seenBars <= period) {
        value = NaN;
      } else {
        value = (prevAtr * (period - 1) + tr) / period;
      }

      if (!replacing) {
        prevClose = lastFinalClose;
        lastFinalClose = bar.close;
        if (!Number.isNaN(value)) prevAtr = value;
        seenBars++;
      }

      return { atr: value };
    },
  };
}

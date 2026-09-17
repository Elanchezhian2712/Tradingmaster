import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

interface RSICore {
  out: Float64Array;
  avgGain: number;
  avgLoss: number;
}

function rsiCore(closes: Float64Array, period: number): RSICore {
  const out = new Float64Array(closes.length).fill(NaN);
  if (closes.length <= period) {
    return { out, avgGain: 0, avgLoss: 0 };
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i]! - closes[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return { out, avgGain, avgLoss };
}

export function computeRSI(closes: Float64Array, period: number): Float64Array {
  return rsiCore(closes, period).out;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** O(1) incremental RSI using Wilder's smoothing recurrence. */
export function createRSI(id: string, period: number): IndicatorInstance {
  let prevAvgGain = 0;
  let prevAvgLoss = 0;
  let seenChanges = 0;
  let prevClose = NaN;
  let lastFinalClose = NaN;

  return {
    id,
    type: "RSI",
    keys: ["rsi"],
    pane: "separate",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const { out, avgGain, avgLoss } = rsiCore(series.close, period);
      prevAvgGain = avgGain;
      prevAvgLoss = avgLoss;
      seenChanges = Math.max(0, series.length - 1);
      lastFinalClose = series.close[series.length - 1] ?? NaN;
      prevClose = series.close[series.length - 2] ?? NaN;
      return { rsi: out };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      const basePrevClose = replacing ? prevClose : lastFinalClose;
      const change = bar.close - basePrevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      let value: number;
      let nextAvgGain: number;
      let nextAvgLoss: number;

      if (seenChanges < period) {
        value = NaN;
        nextAvgGain = prevAvgGain;
        nextAvgLoss = prevAvgLoss;
      } else {
        nextAvgGain = (prevAvgGain * (period - 1) + gain) / period;
        nextAvgLoss = (prevAvgLoss * (period - 1) + loss) / period;
        value = rsiFromAverages(nextAvgGain, nextAvgLoss);
      }

      if (!replacing) {
        prevClose = lastFinalClose;
        lastFinalClose = bar.close;
        prevAvgGain = nextAvgGain;
        prevAvgLoss = nextAvgLoss;
        seenChanges++;
      }

      return { rsi: value };
    },
  };
}

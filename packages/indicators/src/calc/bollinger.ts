import { RingBuffer } from "./ringBuffer";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeBollinger(
  closes: Float64Array,
  period: number,
  stdDevMultiplier: number
): { upper: Float64Array; middle: Float64Array; lower: Float64Array } {
  const n = closes.length;
  const upper = new Float64Array(n).fill(NaN);
  const middle = new Float64Array(n).fill(NaN);
  const lower = new Float64Array(n).fill(NaN);

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = closes[i]!;
    sum += v;
    sumSq += v * v;
    if (i >= period) {
      const old = closes[i - period]!;
      sum -= old;
      sumSq -= old * old;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max(0, sumSq / period - mean * mean);
      const sd = Math.sqrt(variance);
      middle[i] = mean;
      upper[i] = mean + stdDevMultiplier * sd;
      lower[i] = mean - stdDevMultiplier * sd;
    }
  }
  return { upper, middle, lower };
}

export function createBollinger(id: string, period: number, stdDevMultiplier: number): IndicatorInstance {
  const window = new RingBuffer(period);

  function currentBands(): Record<string, number> {
    if (window.size < period) return { upper: NaN, middle: NaN, lower: NaN };
    let sum = 0;
    let sumSq = 0;
    window.forEach((v) => {
      sum += v;
      sumSq += v * v;
    });
    const mean = sum / period;
    const variance = Math.max(0, sumSq / period - mean * mean);
    const sd = Math.sqrt(variance);
    return { upper: mean + stdDevMultiplier * sd, middle: mean, lower: mean - stdDevMultiplier * sd };
  }

  return {
    id,
    type: "BOLLINGER",
    keys: ["upper", "middle", "lower"],
    pane: "overlay",
    params: { period, stdDevMultiplier },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const bands = computeBollinger(series.close, period, stdDevMultiplier);
      for (let i = Math.max(0, series.length - period); i < series.length; i++) {
        window.push(series.close[i]!);
      }
      return bands;
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (replacing) window.replaceLast(bar.close);
      else window.push(bar.close);
      return currentBands();
    },
  };
}

import { RingBuffer } from "./ringBuffer";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeSMA(values: Float64Array, period: number): Float64Array {
  const out = new Float64Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function createSMA(id: string, period: number): IndicatorInstance {
  const window = new RingBuffer(period);

  return {
    id,
    type: "SMA",
    keys: ["sma"],
    pane: "overlay",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const sma = computeSMA(series.close, period);
      for (let i = Math.max(0, series.length - period); i < series.length; i++) {
        window.push(series.close[i]!);
      }
      return { sma };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (replacing) window.replaceLast(bar.close);
      else window.push(bar.close);
      return { sma: window.size >= period ? window.sum() / period : NaN };
    },
  };
}

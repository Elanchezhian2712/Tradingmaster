import { RingBuffer } from "./ringBuffer";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeWMA(values: Float64Array, period: number): Float64Array {
  const out = new Float64Array(values.length).fill(NaN);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let acc = 0;
    for (let w = 0; w < period; w++) {
      acc += values[i - period + 1 + w]! * (w + 1);
    }
    out[i] = acc / denom;
  }
  return out;
}

function weightedAverage(window: RingBuffer, period: number): number {
  const denom = (period * (period + 1)) / 2;
  let acc = 0;
  window.forEach((v, idx) => (acc += v * (idx + 1)));
  return acc / denom;
}

export function createWMA(id: string, period: number): IndicatorInstance {
  const window = new RingBuffer(period);

  return {
    id,
    type: "WMA",
    keys: ["wma"],
    pane: "overlay",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const wma = computeWMA(series.close, period);
      for (let i = Math.max(0, series.length - period); i < series.length; i++) {
        window.push(series.close[i]!);
      }
      return { wma };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (replacing) window.replaceLast(bar.close);
      else window.push(bar.close);
      return { wma: window.size >= period ? weightedAverage(window, period) : NaN };
    },
  };
}

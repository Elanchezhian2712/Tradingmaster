import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeEMA(values: Float64Array, period: number): Float64Array {
  const out = new Float64Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let sum = 0;
  let ema = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i]!;
      if (i === period - 1) {
        ema = sum / period;
        out[i] = ema;
      }
    } else {
      ema = values[i]! * k + ema * (1 - k);
      out[i] = ema;
    }
  }
  return out;
}

/**
 * O(1) incremental EMA. `prev` is the finalized EMA as of the last closed
 * bar; `current` is the tentative value including the still-forming bar,
 * recomputed in O(1) on every tick without touching history.
 */
export function createEMA(id: string, period: number, sourceKey: "close" | "open" | "high" | "low" = "close"): IndicatorInstance {
  const k = 2 / (period + 1);
  let prevFinal = NaN;
  let seenCount = 0;
  let seedSum = 0;
  let lastSeedValue = NaN;
  let current = NaN;

  return {
    id,
    type: "EMA",
    keys: ["ema"],
    pane: "overlay",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const ema = computeEMA(series[sourceKey], period);
      // Every bar in `series` is already closed, so the last computed value
      // is the finalized EMA a subsequent update() should recur from.
      prevFinal = ema[series.length - 1] ?? NaN;
      current = prevFinal;
      seenCount = series.length;
      seedSum = 0;
      return { ema };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      const price = bar[sourceKey];

      if (seenCount < period) {
        // Still accumulating the initial simple-average seed window.
        if (replacing) {
          seedSum = seedSum - lastSeedValue + price;
        } else {
          seedSum += price;
          seenCount++;
        }
        lastSeedValue = price;
        current = seenCount >= period ? seedSum / period : NaN;
        if (!replacing && seenCount === period) prevFinal = current;
        return { ema: current };
      }

      current = price * k + prevFinal * (1 - k);
      if (!replacing) {
        prevFinal = current;
        seenCount++;
      }
      return { ema: current };
    },
  };
}

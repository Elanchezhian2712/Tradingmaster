import { computeEMA } from "./ema";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeMACD(
  closes: Float64Array,
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: Float64Array; signal: Float64Array; histogram: Float64Array } {
  const fast = computeEMA(closes, fastPeriod);
  const slow = computeEMA(closes, slowPeriod);
  const macd = new Float64Array(closes.length);
  for (let i = 0; i < closes.length; i++) macd[i] = fast[i]! - slow[i]!;

  const signal = computeEMA(macd, signalPeriod);
  const histogram = new Float64Array(closes.length);
  for (let i = 0; i < closes.length; i++) histogram[i] = macd[i]! - signal[i]!;

  return { macd, signal, histogram };
}

class EmaState {
  k: number;
  prevFinal = NaN;
  seenCount = 0;
  seedSum = 0;
  lastSeedValue = NaN;

  constructor(public period: number) {
    this.k = 2 / (period + 1);
  }

  step(price: number, replacing: boolean): number {
    if (this.seenCount < this.period) {
      if (replacing) this.seedSum = this.seedSum - this.lastSeedValue + price;
      else {
        this.seedSum += price;
        this.seenCount++;
      }
      this.lastSeedValue = price;
      const value = this.seenCount >= this.period ? this.seedSum / this.period : NaN;
      if (!replacing && this.seenCount === this.period) this.prevFinal = value;
      return value;
    }
    const value = price * this.k + this.prevFinal * (1 - this.k);
    if (!replacing) {
      this.prevFinal = value;
      this.seenCount++;
    }
    return value;
  }
}

/** MACD is composed from three EMA recurrences (fast, slow, signal-of-macd), each O(1) per tick. */
export function createMACD(id: string, fastPeriod: number, slowPeriod: number, signalPeriod: number): IndicatorInstance {
  const fast = new EmaState(fastPeriod);
  const slow = new EmaState(slowPeriod);
  const signal = new EmaState(signalPeriod);

  return {
    id,
    type: "MACD",
    keys: ["macd", "signal", "histogram"],
    pane: "separate",
    params: { fastPeriod, slowPeriod, signalPeriod },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const { macd, signal: sig, histogram } = computeMACD(series.close, fastPeriod, slowPeriod, signalPeriod);
      // Re-derive per-EMA state by replaying the last value of each recurrence.
      const fastFull = computeEMA(series.close, fastPeriod);
      const slowFull = computeEMA(series.close, slowPeriod);
      primeEmaState(fast, fastFull, series.length);
      primeEmaState(slow, slowFull, series.length);
      primeEmaState(signal, macd, series.length);
      return { macd, signal: sig, histogram };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      const fastVal = fast.step(bar.close, replacing);
      const slowVal = slow.step(bar.close, replacing);
      const macdVal = fastVal - slowVal;
      const signalVal = signal.step(macdVal, replacing);
      return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
    },
  };
}

function primeEmaState(state: EmaState, series: Float64Array, length: number): void {
  state.seenCount = length;
  state.prevFinal = series[length - 1] ?? NaN;
}

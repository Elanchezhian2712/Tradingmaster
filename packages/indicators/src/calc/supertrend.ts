import { trueRange } from "./atr";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

interface SupertrendState {
  atr: number;
  finalUpper: number;
  finalLower: number;
  supertrend: number;
  direction: 1 | -1;
  prevClose: number;
  prevHigh: number;
  prevLow: number;
}

function computeCore(
  series: OHLCVSeriesView,
  period: number,
  multiplier: number
): { value: Float64Array; direction: Float64Array; state: SupertrendState | null } {
  const n = series.length;
  const value = new Float64Array(n).fill(NaN);
  const direction = new Float64Array(n).fill(NaN);
  if (n <= period) return { value, direction, state: null };

  let sumTR = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);
  }
  let atr = sumTR / period;

  let finalUpper = (series.high[period]! + series.low[period]!) / 2 + multiplier * atr;
  let finalLower = (series.high[period]! + series.low[period]!) / 2 - multiplier * atr;
  let direction_: 1 | -1 = series.close[period]! <= finalUpper ? -1 : 1;
  let supertrend = direction_ === -1 ? finalUpper : finalLower;
  value[period] = supertrend;
  direction[period] = direction_;

  for (let i = period + 1; i < n; i++) {
    const tr = trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);
    atr = (atr * (period - 1) + tr) / period;

    const mid = (series.high[i]! + series.low[i]!) / 2;
    const basicUpper = mid + multiplier * atr;
    const basicLower = mid - multiplier * atr;

    finalUpper = basicUpper < finalUpper || series.close[i - 1]! > finalUpper ? basicUpper : finalUpper;
    finalLower = basicLower > finalLower || series.close[i - 1]! < finalLower ? basicLower : finalLower;

    if (direction_ === -1) {
      direction_ = series.close[i]! > finalUpper ? 1 : -1;
    } else {
      direction_ = series.close[i]! < finalLower ? -1 : 1;
    }
    supertrend = direction_ === -1 ? finalUpper : finalLower;

    value[i] = supertrend;
    direction[i] = direction_;
  }

  return {
    value,
    direction,
    state: {
      atr,
      finalUpper,
      finalLower,
      supertrend,
      direction: direction_,
      prevClose: series.close[n - 1]!,
      prevHigh: series.high[n - 1]!,
      prevLow: series.low[n - 1]!,
    },
  };
}

export function computeSupertrend(
  series: OHLCVSeriesView,
  period: number,
  multiplier: number
): { value: Float64Array; direction: Float64Array } {
  const { value, direction } = computeCore(series, period, multiplier);
  return { value, direction };
}

/** O(1)-per-tick Supertrend built directly on Wilder's ATR recurrence + band-flip logic. */
export function createSupertrend(id: string, period: number, multiplier: number): IndicatorInstance {
  let state: SupertrendState | null = null;

  return {
    id,
    type: "SUPERTREND",
    keys: ["value", "direction"],
    pane: "overlay",
    params: { period, multiplier },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const core = computeCore(series, period, multiplier);
      state = core.state;
      return { value: core.value, direction: core.direction };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (!state) return { value: NaN, direction: NaN };

      const tr = trueRange(bar.high, bar.low, state.prevClose);
      const atr = (state.atr * (period - 1) + tr) / period;

      const mid = (bar.high + bar.low) / 2;
      const basicUpper = mid + multiplier * atr;
      const basicLower = mid - multiplier * atr;

      const finalUpper = basicUpper < state.finalUpper || state.prevClose > state.finalUpper ? basicUpper : state.finalUpper;
      const finalLower = basicLower > state.finalLower || state.prevClose < state.finalLower ? basicLower : state.finalLower;

      let direction: 1 | -1;
      if (state.direction === -1) {
        direction = bar.close > finalUpper ? 1 : -1;
      } else {
        direction = bar.close < finalLower ? -1 : 1;
      }
      const supertrend = direction === -1 ? finalUpper : finalLower;

      if (!replacing) {
        state = {
          atr,
          finalUpper,
          finalLower,
          supertrend,
          direction,
          prevClose: bar.close,
          prevHigh: bar.high,
          prevLow: bar.low,
        };
      }

      return { value: supertrend, direction };
    },
  };
}

import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

const IST_OFFSET_SEC = 5.5 * 3600;
const SEC_PER_DAY = 86400;

function istDayIndex(timeSec: number): number {
  return Math.floor((timeSec + IST_OFFSET_SEC) / SEC_PER_DAY);
}

export function computeVWAP(series: OHLCVSeriesView): Float64Array {
  const n = series.length;
  const out = new Float64Array(n).fill(NaN);
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = -1;

  for (let i = 0; i < n; i++) {
    const day = istDayIndex(series.time[i]!);
    if (day !== currentDay) {
      currentDay = day;
      cumPV = 0;
      cumVol = 0;
    }
    const typicalPrice = (series.high[i]! + series.low[i]! + series.close[i]!) / 3;
    cumPV += typicalPrice * series.volume[i]!;
    cumVol += series.volume[i]!;
    out[i] = cumVol > 0 ? cumPV / cumVol : typicalPrice;
  }
  return out;
}

/** Session VWAP: resets at the start of each IST trading day, O(1) per bar. */
export function createVWAP(id: string): IndicatorInstance {
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = -1;
  let tentative: { cumPV: number; cumVol: number; day: number } | null = null;

  function apply(bar: OHLCVBar): number {
    const day = istDayIndex(bar.time);
    const base = day !== currentDay ? { cumPV: 0, cumVol: 0 } : { cumPV, cumVol };
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    const nextPV = base.cumPV + typicalPrice * bar.volume;
    const nextVol = base.cumVol + bar.volume;
    tentative = { cumPV: nextPV, cumVol: nextVol, day };
    return nextVol > 0 ? nextPV / nextVol : typicalPrice;
  }

  return {
    id,
    type: "VWAP",
    keys: ["vwap"],
    pane: "overlay",
    params: {},

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const vwap = computeVWAP(series);
      // Recover running totals for the current (last) session so ticks continue correctly.
      let day = -1;
      let pv = 0;
      let vol = 0;
      for (let i = 0; i < series.length; i++) {
        const d = istDayIndex(series.time[i]!);
        if (d !== day) {
          day = d;
          pv = 0;
          vol = 0;
        }
        const tp = (series.high[i]! + series.low[i]! + series.close[i]!) / 3;
        pv += tp * series.volume[i]!;
        vol += series.volume[i]!;
      }
      cumPV = pv;
      cumVol = vol;
      currentDay = day;
      return { vwap };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      const value = apply(bar);
      if (!replacing && tentative) {
        cumPV = tentative.cumPV;
        cumVol = tentative.cumVol;
        currentDay = tentative.day;
      }
      return { vwap: value };
    },
  };
}

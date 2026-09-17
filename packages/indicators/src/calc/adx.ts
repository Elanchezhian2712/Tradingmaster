import { trueRange } from "./atr";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

interface ADXCore {
  plusDI: Float64Array;
  minusDI: Float64Array;
  adx: Float64Array;
  dx: Float64Array;
  state: {
    smoothTR: number;
    smoothPlusDM: number;
    smoothMinusDM: number;
    adxVal: number;
    dxSum: number;
    dxCount: number;
    prevHigh: number;
    prevLow: number;
    prevClose: number;
  } | null;
}

function directionalMoves(high: number, prevHigh: number, low: number, prevLow: number): { plusDM: number; minusDM: number } {
  const upMove = high - prevHigh;
  const downMove = prevLow - low;
  const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
  const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
  return { plusDM, minusDM };
}

function adxCore(series: OHLCVSeriesView, period: number): ADXCore {
  const n = series.length;
  const plusDI = new Float64Array(n).fill(NaN);
  const minusDI = new Float64Array(n).fill(NaN);
  const adx = new Float64Array(n).fill(NaN);
  const dx = new Float64Array(n).fill(NaN);
  if (n <= period * 2) return { plusDI, minusDI, adx, dx, state: null };

  let sumTR = 0,
    sumPlusDM = 0,
    sumMinusDM = 0;
  for (let i = 1; i <= period; i++) {
    const { plusDM, minusDM } = directionalMoves(series.high[i]!, series.high[i - 1]!, series.low[i]!, series.low[i - 1]!);
    sumTR += trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);
    sumPlusDM += plusDM;
    sumMinusDM += minusDM;
  }
  let smoothTR = sumTR / period;
  let smoothPlusDM = sumPlusDM / period;
  let smoothMinusDM = sumMinusDM / period;

  let pDI = 100 * (smoothPlusDM / smoothTR);
  let mDI = 100 * (smoothMinusDM / smoothTR);
  plusDI[period] = pDI;
  minusDI[period] = mDI;
  let dxVal = pDI + mDI === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / (pDI + mDI);
  dx[period] = dxVal;

  let dxSum = dxVal;
  let dxCount = 1;
  let adxVal = NaN;

  for (let i = period + 1; i < n; i++) {
    const { plusDM, minusDM } = directionalMoves(series.high[i]!, series.high[i - 1]!, series.low[i]!, series.low[i - 1]!);
    const tr = trueRange(series.high[i]!, series.low[i]!, series.close[i - 1]!);

    smoothTR = (smoothTR * (period - 1) + tr) / period;
    smoothPlusDM = (smoothPlusDM * (period - 1) + plusDM) / period;
    smoothMinusDM = (smoothMinusDM * (period - 1) + minusDM) / period;

    pDI = 100 * (smoothPlusDM / smoothTR);
    mDI = 100 * (smoothMinusDM / smoothTR);
    plusDI[i] = pDI;
    minusDI[i] = mDI;
    dxVal = pDI + mDI === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / (pDI + mDI);
    dx[i] = dxVal;

    if (dxCount < period) {
      dxSum += dxVal;
      dxCount++;
      if (dxCount === period) {
        adxVal = dxSum / period;
        adx[i] = adxVal;
      }
    } else {
      adxVal = (adxVal * (period - 1) + dxVal) / period;
      adx[i] = adxVal;
    }
  }

  return {
    plusDI,
    minusDI,
    adx,
    dx,
    state: {
      smoothTR,
      smoothPlusDM,
      smoothMinusDM,
      adxVal,
      dxSum,
      dxCount,
      prevHigh: series.high[n - 1]!,
      prevLow: series.low[n - 1]!,
      prevClose: series.close[n - 1]!,
    },
  };
}

export function computeADX(series: OHLCVSeriesView, period: number): { plusDI: Float64Array; minusDI: Float64Array; adx: Float64Array } {
  const { plusDI, minusDI, adx } = adxCore(series, period);
  return { plusDI, minusDI, adx };
}

/**
 * O(1)-per-tick ADX/DI using Wilder's smoothing. The initial directional-index
 * ramp-up (first `period` DX values feeding the ADX seed average) is only
 * exactly reproduced by a full seed() over history; live tick replacement
 * during that ramp window is a best-effort approximation, which is
 * acceptable since seed() is always called with the full historical series
 * before ticks start arriving.
 */
export function createADX(id: string, period: number): IndicatorInstance {
  let state: NonNullable<ADXCore["state"]> | null = null;

  return {
    id,
    type: "ADX",
    keys: ["plusDI", "minusDI", "adx"],
    pane: "separate",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const core = adxCore(series, period);
      state = core.state;
      return { plusDI: core.plusDI, minusDI: core.minusDI, adx: core.adx };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (!state) return { plusDI: NaN, minusDI: NaN, adx: NaN };

      const { plusDM, minusDM } = directionalMoves(bar.high, state.prevHigh, bar.low, state.prevLow);
      const tr = trueRange(bar.high, bar.low, state.prevClose);

      const smoothTR = (state.smoothTR * (period - 1) + tr) / period;
      const smoothPlusDM = (state.smoothPlusDM * (period - 1) + plusDM) / period;
      const smoothMinusDM = (state.smoothMinusDM * (period - 1) + minusDM) / period;

      const pDI = 100 * (smoothPlusDM / smoothTR);
      const mDI = 100 * (smoothMinusDM / smoothTR);
      const dxVal = pDI + mDI === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / (pDI + mDI);
      const adxVal = Number.isNaN(state.adxVal) ? dxVal : (state.adxVal * (period - 1) + dxVal) / period;

      if (!replacing) {
        state = {
          smoothTR,
          smoothPlusDM,
          smoothMinusDM,
          adxVal,
          dxSum: state.dxSum,
          dxCount: state.dxCount,
          prevHigh: bar.high,
          prevLow: bar.low,
          prevClose: bar.close,
        };
      }

      return { plusDI: pDI, minusDI: mDI, adx: adxVal };
    },
  };
}

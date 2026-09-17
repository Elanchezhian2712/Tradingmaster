import { computeSMA } from "./sma";
import { RingBuffer } from "./ringBuffer";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

export function computeVolumeAverage(volume: Float64Array, period: number): Float64Array {
  return computeSMA(volume, period);
}

export function createVolumeAverage(id: string, period: number): IndicatorInstance {
  const window = new RingBuffer(period);

  return {
    id,
    type: "VOLUME_AVERAGE",
    keys: ["average"],
    pane: "separate",
    params: { period },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const average = computeVolumeAverage(series.volume, period);
      for (let i = Math.max(0, series.length - period); i < series.length; i++) {
        window.push(series.volume[i]!);
      }
      return { average };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (replacing) window.replaceLast(bar.volume);
      else window.push(bar.volume);
      return { average: window.size >= period ? window.sum() / period : NaN };
    },
  };
}

import { computeVolumeAverage } from "./volumeAverage";
import { RingBuffer } from "./ringBuffer";
import { IndicatorInstance, IndicatorOutput, OHLCVBar, OHLCVSeriesView } from "../types";

/** ratio = volume / average(volume, period); spike = ratio >= multiplier (1 or 0, easy to plot as a step line). */
export function computeVolumeSpike(
  volume: Float64Array,
  period: number,
  multiplier: number
): { ratio: Float64Array; spike: Float64Array } {
  const average = computeVolumeAverage(volume, period);
  const ratio = new Float64Array(volume.length).fill(NaN);
  const spike = new Float64Array(volume.length).fill(NaN);
  for (let i = 0; i < volume.length; i++) {
    if (Number.isNaN(average[i]) || average[i] === 0) continue;
    ratio[i] = volume[i]! / average[i]!;
    spike[i] = ratio[i]! >= multiplier ? 1 : 0;
  }
  return { ratio, spike };
}

export function createVolumeSpike(id: string, period: number, multiplier: number): IndicatorInstance {
  const window = new RingBuffer(period);

  function currentValues(volume: number): Record<string, number> {
    if (window.size < period) return { ratio: NaN, spike: NaN };
    const avg = window.sum() / period;
    if (avg === 0) return { ratio: NaN, spike: NaN };
    const ratio = volume / avg;
    return { ratio, spike: ratio >= multiplier ? 1 : 0 };
  }

  return {
    id,
    type: "VOLUME_SPIKE",
    keys: ["ratio", "spike"],
    pane: "separate",
    params: { period, multiplier },

    seed(series: OHLCVSeriesView): IndicatorOutput {
      const { ratio, spike } = computeVolumeSpike(series.volume, period, multiplier);
      for (let i = Math.max(0, series.length - period); i < series.length; i++) {
        window.push(series.volume[i]!);
      }
      return { ratio, spike };
    },

    update(bar: OHLCVBar, replacing: boolean): Record<string, number> {
      if (replacing) window.replaceLast(bar.volume);
      else window.push(bar.volume);
      return currentValues(bar.volume);
    },
  };
}

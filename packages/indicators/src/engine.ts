import { createADX } from "./calc/adx";
import { createATR } from "./calc/atr";
import { createBollinger } from "./calc/bollinger";
import { createEMA } from "./calc/ema";
import { createMACD } from "./calc/macd";
import { createRSI } from "./calc/rsi";
import { createSMA } from "./calc/sma";
import { createSupertrend } from "./calc/supertrend";
import { createVolumeAverage } from "./calc/volumeAverage";
import { createVolumeSpike } from "./calc/volumeSpike";
import { createVWAP } from "./calc/vwap";
import { createWMA } from "./calc/wma";
import { GrowableFloat64 } from "./growable";
import { DEFAULT_PANE, IndicatorInstance, IndicatorType, OHLCVBar, OHLCVSeriesView, PaneKind } from "./types";

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  enabled?: boolean;
}

export function createIndicatorInstance(config: IndicatorConfig): IndicatorInstance {
  const p = config.params;
  switch (config.type) {
    case "SMA":
      return createSMA(config.id, p.period ?? 20);
    case "EMA":
      return createEMA(config.id, p.period ?? 21);
    case "WMA":
      return createWMA(config.id, p.period ?? 20);
    case "VWAP":
      return createVWAP(config.id);
    case "RSI":
      return createRSI(config.id, p.period ?? 14);
    case "MACD":
      return createMACD(config.id, p.fastPeriod ?? 12, p.slowPeriod ?? 26, p.signalPeriod ?? 9);
    case "ATR":
      return createATR(config.id, p.period ?? 14);
    case "ADX":
      return createADX(config.id, p.period ?? 14);
    case "SUPERTREND":
      return createSupertrend(config.id, p.period ?? 10, p.multiplier ?? 3);
    case "BOLLINGER":
      return createBollinger(config.id, p.period ?? 20, p.stdDevMultiplier ?? 2);
    case "VOLUME_AVERAGE":
      return createVolumeAverage(config.id, p.period ?? 20);
    case "VOLUME_SPIKE":
      return createVolumeSpike(config.id, p.period ?? 20, p.multiplier ?? 2);
  }
}

interface ManagedIndicator {
  instance: IndicatorInstance;
  enabled: boolean;
  pane: PaneKind;
  series: Record<string, GrowableFloat64>;
}

/**
 * Owns a set of running indicator instances against one candle series.
 * Runs inside a Web Worker in production so indicator math never blocks
 * the main thread; the chart only ever receives the resulting typed
 * arrays to render.
 */
export class IndicatorEngine {
  private managed = new Map<string, ManagedIndicator>();
  private series: OHLCVSeriesView | null = null;

  /** Call whenever the full historical series changes (initial load, symbol/timeframe switch). */
  seedAll(series: OHLCVSeriesView): void {
    this.series = series;
    for (const m of this.managed.values()) this.seedOne(m);
  }

  private seedOne(m: ManagedIndicator): void {
    if (!this.series) return;
    const output = m.instance.seed(this.series);
    m.series = {};
    for (const key of m.instance.keys) {
      m.series[key] = new GrowableFloat64(Float64Array.from(output[key] ?? []));
    }
  }

  add(config: IndicatorConfig): void {
    const instance = createIndicatorInstance(config);
    const managed: ManagedIndicator = {
      instance,
      enabled: config.enabled ?? true,
      pane: instance.pane,
      series: {},
    };
    this.managed.set(config.id, managed);
    if (this.series) this.seedOne(managed);
  }

  remove(id: string): void {
    this.managed.delete(id);
  }

  setEnabled(id: string, enabled: boolean): void {
    const m = this.managed.get(id);
    if (m) m.enabled = enabled;
  }

  /** Recreates an instance with new params and reseeds it against the current series. */
  updateParams(id: string, type: IndicatorType, params: Record<string, number>): void {
    const existing = this.managed.get(id);
    const enabled = existing?.enabled ?? true;
    this.add({ id, type, params, enabled });
  }

  /** Folds one bar into every enabled instance. `replacing` = tick update to the still-forming last bar. */
  onBar(bar: OHLCVBar, replacing: boolean): void {
    for (const m of this.managed.values()) {
      if (!m.enabled) continue;
      const values = m.instance.update(bar, replacing);
      for (const key of m.instance.keys) {
        const value = values[key] ?? NaN;
        const growable = m.series[key];
        if (!growable) continue;
        if (replacing) growable.replaceLast(value);
        else growable.push(value);
      }
    }
  }

  getOutput(id: string): Record<string, Float64Array> | null {
    const m = this.managed.get(id);
    if (!m) return null;
    const out: Record<string, Float64Array> = {};
    for (const key of m.instance.keys) out[key] = m.series[key]?.view() ?? new Float64Array(0);
    return out;
  }

  list(): { id: string; type: IndicatorType; pane: PaneKind; enabled: boolean; params: Record<string, number> }[] {
    return Array.from(this.managed.entries()).map(([id, m]) => ({
      id,
      type: m.instance.type,
      pane: m.pane,
      enabled: m.enabled,
      params: m.instance.params,
    }));
  }
}

export { DEFAULT_PANE };

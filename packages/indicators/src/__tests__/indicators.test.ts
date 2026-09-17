import { describe, expect, it } from "vitest";
import { computeSMA } from "../calc/sma";
import { computeEMA } from "../calc/ema";
import { computeRSI } from "../calc/rsi";
import { computeBollinger } from "../calc/bollinger";
import { createIndicatorInstance, IndicatorConfig } from "../engine";
import { barAt, slice, syntheticSeries } from "./testFixtures";
import { IndicatorType } from "../types";

describe("computeSMA", () => {
  it("matches a naive rolling average", () => {
    const values = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const sma = computeSMA(values, 3);
    expect(sma[2]).toBeCloseTo((1 + 2 + 3) / 3);
    expect(sma[7]).toBeCloseTo((6 + 7 + 8) / 3);
    expect(Number.isNaN(sma[1])).toBe(true);
  });
});

describe("computeEMA", () => {
  it("seeds with a simple average then applies the EMA recurrence", () => {
    const values = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const period = 3;
    const ema = computeEMA(values, period);
    const seed = (1 + 2 + 3) / 3;
    expect(ema[2]).toBeCloseTo(seed);
    const k = 2 / (period + 1);
    const next = 4 * k + seed * (1 - k);
    expect(ema[3]).toBeCloseTo(next);
  });
});

describe("computeRSI", () => {
  it("stays within [0, 100]", () => {
    const series = syntheticSeries(300, 2);
    const rsi = computeRSI(series.close, 14);
    for (let i = 20; i < rsi.length; i++) {
      expect(rsi[i]).toBeGreaterThanOrEqual(0);
      expect(rsi[i]).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeBollinger", () => {
  it("keeps upper >= middle >= lower", () => {
    const series = syntheticSeries(200, 3);
    const { upper, middle, lower } = computeBollinger(series.close, 20, 2);
    for (let i = 25; i < series.length; i++) {
      expect(upper[i]!).toBeGreaterThanOrEqual(middle[i]!);
      expect(middle[i]!).toBeGreaterThanOrEqual(lower[i]!);
    }
  });
});

describe("incremental updates match full recompute", () => {
  const cases: { type: IndicatorType; params: Record<string, number>; key: string; tolerance: number }[] = [
    { type: "SMA", params: { period: 10 }, key: "sma", tolerance: 1e-6 },
    { type: "EMA", params: { period: 10 }, key: "ema", tolerance: 1e-6 },
    { type: "WMA", params: { period: 10 }, key: "wma", tolerance: 1e-6 },
    { type: "RSI", params: { period: 14 }, key: "rsi", tolerance: 1e-6 },
    { type: "ATR", params: { period: 14 }, key: "atr", tolerance: 1e-6 },
    { type: "BOLLINGER", params: { period: 20, stdDevMultiplier: 2 }, key: "middle", tolerance: 1e-6 },
    { type: "VOLUME_AVERAGE", params: { period: 20 }, key: "average", tolerance: 1e-6 },
  ];

  for (const c of cases) {
    it(`${c.type}: seeding N-5 bars then streaming 5 more matches a full ${c.type} recompute over all N bars`, () => {
      const full = syntheticSeries(300, 42);
      const config: IndicatorConfig = { id: "test", type: c.type, params: c.params };

      const reference = createIndicatorInstance(config);
      const referenceOutput = reference.seed(full);

      const streaming = createIndicatorInstance(config);
      const partial = slice(full, full.length - 5);
      streaming.seed(partial);

      let lastValues: Record<string, number> = {};
      for (let i = partial.length; i < full.length; i++) {
        lastValues = streaming.update(barAt(full, i), false);
      }

      expect(lastValues[c.key]).toBeCloseTo(referenceOutput[c.key]![full.length - 1]!, 4);
    });
  }
});

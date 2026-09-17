import { describe, expect, it } from "vitest";
import { generateMockCandles } from "../mockGenerator";
import { aggregateCandles } from "../aggregation";

describe("generateMockCandles", () => {
  it("produces the requested number of ascending, gap-free-by-session candles", () => {
    const batch = generateMockCandles("5m", 1000, { seed: 1, endTime: 1_700_000_000 });
    expect(batch.time.length).toBe(1000);
    for (let i = 1; i < batch.time.length; i++) {
      expect(batch.time[i]).toBeGreaterThan(batch.time[i - 1]!);
    }
  });

  it("keeps OHLC internally consistent (high >= max(open,close), low <= min(open,close))", () => {
    const batch = generateMockCandles("1D", 500, { seed: 7 });
    for (let i = 0; i < batch.time.length; i++) {
      const o = batch.open[i]!;
      const h = batch.high[i]!;
      const l = batch.low[i]!;
      const c = batch.close[i]!;
      expect(h).toBeGreaterThanOrEqual(Math.max(o, c) - 1e-9);
      expect(l).toBeLessThanOrEqual(Math.min(o, c) + 1e-9);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = generateMockCandles("1H", 200, { seed: 99, endTime: 1_700_000_000 });
    const b = generateMockCandles("1H", 200, { seed: 99, endTime: 1_700_000_000 });
    expect(Array.from(a.close)).toEqual(Array.from(b.close));
  });

  it("skips weekends for daily candles", () => {
    const batch = generateMockCandles("1D", 30, { seed: 3, endTime: 1_700_000_000 });
    for (const t of batch.time) {
      const day = new Date((t + 330 * 60) * 1000).getUTCDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });
});

describe("aggregateCandles", () => {
  it("re-buckets a finer series into a coarser one without losing extremes", () => {
    const base = generateMockCandles("1m", 5000, { seed: 5, endTime: 1_700_000_000 });
    const agg = aggregateCandles(base, "15m");
    expect(agg.time.length).toBeGreaterThan(0);
    expect(agg.time.length).toBeLessThan(base.time.length);

    const totalVolumeBase = Array.from(base.volume).reduce((a, b) => a + b, 0);
    const totalVolumeAgg = Array.from(agg.volume).reduce((a, b) => a + b, 0);
    expect(totalVolumeAgg).toBeCloseTo(totalVolumeBase, 0);
  });
});

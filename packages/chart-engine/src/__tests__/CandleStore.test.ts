import { describe, expect, it } from "vitest";
import { CandleStore } from "../data/CandleStore";
import { CandleBatch } from "@trading-master/market-data";

function batch(times: number[]): CandleBatch {
  const n = times.length;
  return {
    time: Float64Array.from(times),
    open: Float64Array.from(times.map((t) => t)),
    high: Float64Array.from(times.map((t) => t + 1)),
    low: Float64Array.from(times.map((t) => t - 1)),
    close: Float64Array.from(times.map((t) => t + 0.5)),
    volume: new Float64Array(n).fill(100),
  };
}

describe("CandleStore", () => {
  it("appends and replaces the last bar without touching earlier data", () => {
    const store = new CandleStore();
    store.setData(batch([1, 2, 3]));
    expect(store.length).toBe(3);

    store.pushBar({ time: 4, open: 4, high: 5, low: 3, close: 4.5, volume: 100 });
    expect(store.length).toBe(4);
    expect(store.barAt(3)?.time).toBe(4);

    store.replaceLast({ time: 4, open: 4, high: 9, low: 3, close: 8, volume: 250 });
    expect(store.length).toBe(4);
    expect(store.barAt(3)?.high).toBe(9);
    expect(store.barAt(0)?.time).toBe(1);
  });

  it("prepends older history ahead of existing data", () => {
    const store = new CandleStore();
    store.setData(batch([10, 11, 12]));
    store.prependData(batch([7, 8, 9]));
    expect(store.length).toBe(6);
    expect(Array.from(store.toSeriesView().time)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("lowerBound finds the first index at or after a given time", () => {
    const store = new CandleStore();
    store.setData(batch([10, 20, 30, 40]));
    expect(store.lowerBound(25)).toBe(2);
    expect(store.lowerBound(10)).toBe(0);
    expect(store.lowerBound(41)).toBe(4);
  });

  it("computes price range and max volume over an index window", () => {
    const store = new CandleStore();
    store.setData(batch([1, 2, 3, 4, 5]));
    const range = store.priceRange(1, 3);
    expect(range.min).toBe(1); // low = time - 1, min over indices 1..3 -> low[1]=1
    expect(range.max).toBe(5); // high = time + 1, max over indices 1..3 -> high[3]=5
  });
});

import { OHLCVBar, OHLCVSeriesView } from "../types";

/** Small deterministic synthetic OHLCV series, self-contained so indicator tests don't depend on the market-data package. */
export function syntheticSeries(count: number, seed = 1): OHLCVSeriesView {
  let a = seed;
  const rand = () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };

  const time = new Float64Array(count);
  const open = new Float64Array(count);
  const high = new Float64Array(count);
  const low = new Float64Array(count);
  const close = new Float64Array(count);
  const volume = new Float64Array(count);

  let price = 100;
  for (let i = 0; i < count; i++) {
    const o = price;
    const change = (rand() - 0.5) * 2;
    const c = Math.max(1, o + change);
    const h = Math.max(o, c) + rand();
    const l = Math.min(o, c) - rand();
    time[i] = i * 60;
    open[i] = o;
    high[i] = h;
    low[i] = l;
    close[i] = c;
    volume[i] = 1000 + rand() * 500;
    price = c;
  }

  return { time, open, high, low, close, volume, length: count };
}

export function barAt(series: OHLCVSeriesView, i: number): OHLCVBar {
  return {
    time: series.time[i]!,
    open: series.open[i]!,
    high: series.high[i]!,
    low: series.low[i]!,
    close: series.close[i]!,
    volume: series.volume[i]!,
  };
}

export function slice(series: OHLCVSeriesView, end: number): OHLCVSeriesView {
  return {
    time: series.time.slice(0, end),
    open: series.open.slice(0, end),
    high: series.high.slice(0, end),
    low: series.low.slice(0, end),
    close: series.close.slice(0, end),
    volume: series.volume.slice(0, end),
    length: end,
  };
}

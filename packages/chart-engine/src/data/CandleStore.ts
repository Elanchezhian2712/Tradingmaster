import { GrowableFloat64 } from "@trading-master/indicators";
import { CandleBatch, CandleSnapshot } from "@trading-master/market-data";
import { OHLCVSeriesView } from "@trading-master/indicators";

/**
 * Structure-of-arrays candle storage. Every mutation (append, prepend,
 * replace-last) is O(1) amortized and never re-allocates the whole
 * series, which is what lets the renderer stay responsive from 10k up
 * to 500k+ candles.
 */
export class CandleStore {
  private time = new GrowableFloat64(new Float64Array(0));
  private open = new GrowableFloat64(new Float64Array(0));
  private high = new GrowableFloat64(new Float64Array(0));
  private low = new GrowableFloat64(new Float64Array(0));
  private close = new GrowableFloat64(new Float64Array(0));
  private volume = new GrowableFloat64(new Float64Array(0));

  get length(): number {
    return this.time.length;
  }

  /** Replaces the entire series (initial load, symbol/timeframe switch). */
  setData(batch: CandleBatch): void {
    this.time = new GrowableFloat64(Float64Array.from(batch.time));
    this.open = new GrowableFloat64(Float64Array.from(batch.open));
    this.high = new GrowableFloat64(Float64Array.from(batch.high));
    this.low = new GrowableFloat64(Float64Array.from(batch.low));
    this.close = new GrowableFloat64(Float64Array.from(batch.close));
    this.volume = new GrowableFloat64(Float64Array.from(batch.volume));
  }

  /** Prepends older history (infinite scroll to the left). */
  prependData(batch: CandleBatch): void {
    if (batch.time.length === 0) return;
    const merge = (existing: GrowableFloat64, incoming: Float64Array) => {
      const combined = new Float64Array(incoming.length + existing.length);
      combined.set(incoming, 0);
      combined.set(existing.view(), incoming.length);
      return new GrowableFloat64(combined);
    };
    this.time = merge(this.time, batch.time);
    this.open = merge(this.open, batch.open);
    this.high = merge(this.high, batch.high);
    this.low = merge(this.low, batch.low);
    this.close = merge(this.close, batch.close);
    this.volume = merge(this.volume, batch.volume);
  }

  /** Appends a newly closed candle after the current last one. */
  pushBar(bar: CandleSnapshot): void {
    this.time.push(bar.time);
    this.open.push(bar.open);
    this.high.push(bar.high);
    this.low.push(bar.low);
    this.close.push(bar.close);
    this.volume.push(bar.volume);
  }

  /** Overwrites the still-forming last candle in place (live tick update). */
  replaceLast(bar: CandleSnapshot): void {
    if (this.length === 0) {
      this.pushBar(bar);
      return;
    }
    this.time.replaceLast(bar.time);
    this.open.replaceLast(bar.open);
    this.high.replaceLast(bar.high);
    this.low.replaceLast(bar.low);
    this.close.replaceLast(bar.close);
    this.volume.replaceLast(bar.volume);
  }

  /** Binary search for the first index whose time is >= t. */
  lowerBound(t: number): number {
    const arr = this.time.view();
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  barAt(index: number): CandleSnapshot | null {
    if (index < 0 || index >= this.length) return null;
    return {
      time: this.time.view()[index]!,
      open: this.open.view()[index]!,
      high: this.high.view()[index]!,
      low: this.low.view()[index]!,
      close: this.close.view()[index]!,
      volume: this.volume.view()[index]!,
    };
  }

  /** Zero-copy view over the live data, suitable for feeding the indicator engine. */
  toSeriesView(): OHLCVSeriesView {
    return {
      time: this.time.view(),
      open: this.open.view(),
      high: this.high.view(),
      low: this.low.view(),
      close: this.close.view(),
      volume: this.volume.view(),
      length: this.length,
    };
  }

  /** Min/max close/high/low over an index range, used to auto-scale the price axis. */
  priceRange(startIndex: number, endIndex: number): { min: number; max: number } {
    const hi = this.high.view();
    const lo = this.low.view();
    const s = Math.max(0, Math.floor(startIndex));
    const e = Math.min(this.length - 1, Math.ceil(endIndex));
    let min = Infinity;
    let max = -Infinity;
    for (let i = s; i <= e; i++) {
      if (lo[i]! < min) min = lo[i]!;
      if (hi[i]! > max) max = hi[i]!;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
    return { min, max };
  }

  maxVolume(startIndex: number, endIndex: number): number {
    const vol = this.volume.view();
    const s = Math.max(0, Math.floor(startIndex));
    const e = Math.min(this.length - 1, Math.ceil(endIndex));
    let max = 0;
    for (let i = s; i <= e; i++) {
      if (vol[i]! > max) max = vol[i]!;
    }
    return max;
  }
}

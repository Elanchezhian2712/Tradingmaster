import { CandleBatch, CandleSnapshot, Timeframe, TIMEFRAME_SECONDS, Tick, createCandleBatch } from "./types";

/** Floors a unix-seconds timestamp to the start of its timeframe bucket (UTC-aligned). */
export function bucketStart(timeSec: number, timeframe: Timeframe): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(timeSec / size) * size;
}

/**
 * Incrementally folds a tick into the current open candle for a bucket,
 * or starts a new one if the tick belongs to the next bucket.
 * Returns the updated snapshot and whether the previous candle closed.
 */
export class CandleAggregator {
  private current: CandleSnapshot | null = null;

  constructor(private readonly timeframe: Timeframe) {}

  ingest(tick: Tick): { candle: CandleSnapshot; closedPrevious: CandleSnapshot | null } {
    const bucket = bucketStart(tick.timestamp / 1000, this.timeframe);
    let closedPrevious: CandleSnapshot | null = null;

    if (!this.current || this.current.time !== bucket) {
      if (this.current) closedPrevious = this.current;
      this.current = {
        time: bucket,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
      };
    } else {
      this.current.high = Math.max(this.current.high, tick.price);
      this.current.low = Math.min(this.current.low, tick.price);
      this.current.close = tick.price;
      this.current.volume += tick.size;
    }

    return { candle: this.current, closedPrevious };
  }

  get openCandle(): CandleSnapshot | null {
    return this.current;
  }
}

/**
 * Re-buckets a lower-timeframe candle batch (typically 1m) into a higher
 * timeframe without needing raw ticks. Used to derive 5m/15m/1H/etc. from
 * a single base-resolution dataset, both for the mock provider and for
 * any real vendor that only ships 1m history.
 */
export function aggregateCandles(base: CandleBatch, targetTimeframe: Timeframe): CandleBatch {
  const n = base.time.length;
  if (n === 0) return createCandleBatch(0);

  const size = TIMEFRAME_SECONDS[targetTimeframe];
  const outTime: number[] = [];
  const outOpen: number[] = [];
  const outHigh: number[] = [];
  const outLow: number[] = [];
  const outClose: number[] = [];
  const outVolume: number[] = [];

  let bucket = Math.floor(base.time[0]! / size) * size;
  let o = base.open[0]!;
  let h = base.high[0]!;
  let l = base.low[0]!;
  let c = base.close[0]!;
  let v = base.volume[0]!;

  for (let i = 1; i < n; i++) {
    const t = base.time[i]!;
    const nextBucket = Math.floor(t / size) * size;
    if (nextBucket !== bucket) {
      outTime.push(bucket);
      outOpen.push(o);
      outHigh.push(h);
      outLow.push(l);
      outClose.push(c);
      outVolume.push(v);

      bucket = nextBucket;
      o = base.open[i]!;
      h = base.high[i]!;
      l = base.low[i]!;
      c = base.close[i]!;
      v = base.volume[i]!;
    } else {
      h = Math.max(h, base.high[i]!);
      l = Math.min(l, base.low[i]!);
      c = base.close[i]!;
      v += base.volume[i]!;
    }
  }
  outTime.push(bucket);
  outOpen.push(o);
  outHigh.push(h);
  outLow.push(l);
  outClose.push(c);
  outVolume.push(v);

  return {
    time: Float64Array.from(outTime),
    open: Float64Array.from(outOpen),
    high: Float64Array.from(outHigh),
    low: Float64Array.from(outLow),
    close: Float64Array.from(outClose),
    volume: Float64Array.from(outVolume),
  };
}

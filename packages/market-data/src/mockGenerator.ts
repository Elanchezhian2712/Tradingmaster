import { CandleBatch, Timeframe, TIMEFRAME_SECONDS, createCandleBatch } from "./types";

const SEC_PER_DAY = 86400;
/** NSE cash-market session: 09:15 - 15:30 IST, expressed as seconds-of-day in IST. */
const SESSION_START = 9 * 3600 + 15 * 60;
const SESSION_END = 15 * 3600 + 30 * 60;
const SESSION_LEN = SESSION_END - SESSION_START;
const IST_OFFSET = 5.5 * 3600;

/** Deterministic PRNG (mulberry32) so a given seed always reproduces the same series. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** 1970-01-01 (day index 0) was a Thursday (weekday 4, 0=Sunday). */
function weekdayOf(dayIndex: number): number {
  return (((dayIndex + 4) % 7) + 7) % 7;
}
function isTradingDay(dayIndex: number): boolean {
  const w = weekdayOf(dayIndex);
  return w >= 1 && w <= 5;
}

export interface MockSeriesOptions {
  seed?: number;
  startPrice?: number;
  /** Roughly annualized-daily volatility fraction, e.g. 0.015 = 1.5%/day. */
  dailyVolatility?: number;
  baseVolume?: number;
  /** Series ends at this unix-second timestamp (defaults to "now"). */
  endTime?: number;
}

interface OhlcvStep {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function walkStep(prevClose: number, volPerStep: number, baseVolume: number, rng: () => number): OhlcvStep {
  const open = prevClose;
  let price = open;
  let high = open;
  let low = open;
  const subSteps = 6;
  for (let i = 0; i < subSteps; i++) {
    price = Math.max(0.05, price * (1 + gaussian(rng) * (volPerStep / Math.sqrt(subSteps))));
    if (price > high) high = price;
    if (price < low) low = price;
  }
  const close = price;
  const spike = rng() < 0.03 ? 1 + rng() * 4 : 1;
  const volume = Math.max(0, Math.round(baseVolume * (0.4 + rng() * 1.2) * spike));
  return { open, high, low, close, volume };
}

/**
 * Generates `count` candles for `timeframe` ending at `endTime` (default now),
 * walking backward through a realistic NSE trading calendar (weekdays only,
 * 09:15-15:30 IST session for intraday resolutions). Pure function, safe to
 * call from a worker; returns typed-array (SoA) data ready to hand to the
 * chart renderer with zero further transformation.
 */
export function generateMockCandles(timeframe: Timeframe, count: number, options: MockSeriesOptions = {}): CandleBatch {
  const seed = options.seed ?? 42;
  const rng = mulberry32(seed);
  const dailyVol = options.dailyVolatility ?? 0.015;
  const baseVolume = options.baseVolume ?? 50_000;
  const stepSec = TIMEFRAME_SECONDS[timeframe];
  const endTime = options.endTime ?? Math.floor(Date.now() / 1000);

  const timestamps = computeTimestamps(timeframe, count, endTime);
  const volPerStep = dailyVol * Math.sqrt(Math.min(1, stepSec / SEC_PER_DAY)) || dailyVol;

  const batch = createCandleBatch(count);
  let prevClose = options.startPrice ?? 1000 + rng() * 2000;

  for (let i = 0; i < count; i++) {
    const step = walkStep(prevClose, volPerStep, baseVolume, rng);
    batch.time[i] = timestamps[i]!;
    batch.open[i] = step.open;
    batch.high[i] = step.high;
    batch.low[i] = step.low;
    batch.close[i] = step.close;
    batch.volume[i] = step.volume;
    prevClose = step.close;
  }

  return batch;
}

/** Builds ascending unix-second timestamps for `count` buckets ending at `endTime`. */
function computeTimestamps(timeframe: Timeframe, count: number, endTime: number): Float64Array {
  const stepSec = TIMEFRAME_SECONDS[timeframe];
  const out = new Float64Array(count);

  if (stepSec >= 7 * SEC_PER_DAY) {
    // Weekly / monthly: granularity already swallows weekends, so a plain fixed step is fine.
    const lastBucket = Math.floor(endTime / stepSec) * stepSec;
    for (let i = 0; i < count; i++) {
      out[count - 1 - i] = lastBucket - i * stepSec;
    }
    return out;
  }

  if (stepSec === SEC_PER_DAY) {
    let dayIdx = Math.floor((endTime + IST_OFFSET) / SEC_PER_DAY);
    let filled = 0;
    const rev: number[] = [];
    while (filled < count) {
      if (isTradingDay(dayIdx)) {
        rev.push(dayIdx * SEC_PER_DAY + SESSION_START - IST_OFFSET);
        filled++;
      }
      dayIdx--;
    }
    rev.reverse();
    return Float64Array.from(rev);
  }

  // Intraday: `perDay` buckets per trading day within the session window.
  const perDay = Math.max(1, Math.floor(SESSION_LEN / stepSec));
  let dayIdx = Math.floor((endTime + IST_OFFSET) / SEC_PER_DAY);
  const rev: number[] = [];
  let filled = 0;
  // Start from the last trading day at/before endTime's day.
  while (filled < count) {
    if (isTradingDay(dayIdx)) {
      const slotsThisDay = Math.min(perDay, count - filled);
      for (let s = 0; s < slotsThisDay; s++) {
        const secInDay = SESSION_START + (perDay - 1 - s) * stepSec;
        rev.push(dayIdx * SEC_PER_DAY + secInDay - IST_OFFSET);
      }
      filled += slotsThisDay;
    }
    dayIdx--;
  }
  rev.reverse();
  return Float64Array.from(rev);
}

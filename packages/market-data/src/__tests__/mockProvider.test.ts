import { describe, expect, it } from "vitest";
import { MockMarketDataProvider, hashSeedFromSymbol, referencePriceForSymbol } from "../mockProvider";
import { generateMockCandles } from "../mockGenerator";

/** Deterministic PRNG so the statistics below are reproducible. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

describe("MockMarketDataProvider quotes", () => {
  it("quotes a symbol at the price its historical series ends at, on every timeframe", async () => {
    const provider = new MockMarketDataProvider();
    const reference = referencePriceForSymbol("RELIANCE");
    const quote = await provider.getQuote("RELIANCE");

    // One random-walk step (max 0.2%) separates the quote from the reference price.
    expect(quote.ltp).toBeGreaterThan(reference * 0.99);
    expect(quote.ltp).toBeLessThan(reference * 1.01);

    // The whole point: the chart and the watchlist cannot disagree about where
    // the market is, whichever timeframe is charted.
    const seed = hashSeedFromSymbol("RELIANCE");
    for (const timeframe of ["1m", "5m", "1D"] as const) {
      const batch = generateMockCandles(timeframe, 2000, { seed, endPrice: reference });
      expect(batch.close[batch.close.length - 1]!).toBeCloseTo(reference, 6);
    }
  });

  it("keeps OHLC internally consistent after scaling a series to its end price", () => {
    const batch = generateMockCandles("5m", 500, { seed: 7, endPrice: 1234.5 });
    for (let i = 0; i < batch.time.length; i++) {
      expect(batch.high[i]!).toBeGreaterThanOrEqual(Math.max(batch.open[i]!, batch.close[i]!));
      expect(batch.low[i]!).toBeLessThanOrEqual(Math.min(batch.open[i]!, batch.close[i]!));
      expect(batch.low[i]!).toBeGreaterThan(0);
    }
    expect(batch.close[batch.close.length - 1]!).toBeCloseTo(1234.5, 6);
  });

  it("walks continuously across polls instead of jumping to a new random price", async () => {
    const provider = new MockMarketDataProvider();
    let previous = (await provider.getQuote("TCS")).ltp;
    for (let i = 0; i < 25; i++) {
      const next = (await provider.getQuote("TCS")).ltp;
      expect(Math.abs(next - previous) / previous).toBeLessThan(0.01);
      previous = next;
    }
  });

  it("anchors the live price to a loaded historical series", async () => {
    const provider = new MockMarketDataProvider();
    const batch = generateMockCandles("5m", 500, {
      seed: hashSeedFromSymbol("INFY"),
      endPrice: referencePriceForSymbol("INFY"),
    });
    const lastClose = batch.close[batch.close.length - 1]!;

    provider.setReferencePrice("INFY", lastClose);
    const quote = await provider.getQuote("INFY");

    expect(Math.abs(quote.ltp - lastClose) / lastClose).toBeLessThan(0.01);
    expect(quote.prevClose).toBe(lastClose);
  });

  it("keeps session statistics consistent with the prices it has emitted", async () => {
    const provider = new MockMarketDataProvider();
    provider.setReferencePrice("SBIN", 600);

    let last = 600;
    for (let i = 0; i < 50; i++) last = (await provider.getQuote("SBIN")).ltp;

    const quote = await provider.getQuote("SBIN");
    expect(quote.high).toBeGreaterThanOrEqual(quote.ltp);
    expect(quote.low).toBeLessThanOrEqual(quote.ltp);
    expect(quote.open).toBe(600);
    expect(quote.prevClose).toBe(600);
    expect(quote.change).toBeCloseTo(quote.ltp - 600);
    expect(quote.changePercent).toBeCloseTo(((quote.ltp - 600) / 600) * 100);
    expect(quote.volume).toBeGreaterThan(0);
    expect(last).toBeGreaterThan(0);
  });

  it("gives different symbols different price levels", async () => {
    const provider = new MockMarketDataProvider();
    const a = (await provider.getQuote("AAA")).ltp;
    const b = (await provider.getQuote("BBB")).ltp;
    expect(a).not.toBeCloseTo(b);
  });
});

describe("live price volatility", () => {
  /**
   * The bug this pins down: the tick walk used a hardcoded +/-0.2% per tick,
   * unrelated to the generator's daily volatility, which made a live 5-minute
   * bar about 22x the size of the historical 5-minute bars beside it. The
   * chart auto-scales to fit, so the entire history collapsed to a flat line
   * as soon as the first live bars formed.
   */
  it("moves a live 5-minute bar by about as much as a historical one", async () => {
    let clock = Date.UTC(2026, 8, 17, 5, 0);
    const provider = new MockMarketDataProvider({ now: () => clock, random: seededRandom(99) });
    provider.setReferencePrice("RELIANCE", 2500);

    const liveReturns: number[] = [];
    for (let bar = 0; bar < 120; bar++) {
      const open = (await provider.getQuote("RELIANCE")).ltp;
      let close = open;
      for (let tick = 0; tick < 300; tick++) {
        clock += 1000;
        close = (await provider.getQuote("RELIANCE")).ltp;
      }
      liveReturns.push(Math.log(close / open));
    }

    const historical = generateMockCandles("5m", 3000, { seed: 4242 });
    const historicalReturns: number[] = [];
    for (let i = 1; i < historical.close.length; i++) {
      historicalReturns.push(Math.log(historical.close[i]! / historical.close[i - 1]!));
    }

    const ratio = stdev(liveReturns) / stdev(historicalReturns);
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  it("scales a step by elapsed time, so polling more often does not add volatility", async () => {
    async function walk(stepMs: number, steps: number): Promise<number> {
      let clock = Date.UTC(2026, 8, 17, 5, 0);
      const provider = new MockMarketDataProvider({ now: () => clock, random: seededRandom(7) });
      provider.setReferencePrice("TCS", 4000);
      const moves: number[] = [];
      let price = (await provider.getQuote("TCS")).ltp;
      for (let run = 0; run < 400; run++) {
        const open = price;
        for (let i = 0; i < steps; i++) {
          clock += stepMs;
          price = (await provider.getQuote("TCS")).ltp;
        }
        moves.push(Math.log(price / open));
      }
      return stdev(moves);
    }

    // Same 60 seconds of wall-clock, polled once a second vs. four times a second.
    const slow = await walk(1000, 60);
    const fast = await walk(250, 240);
    expect(fast / slow).toBeGreaterThan(0.6);
    expect(fast / slow).toBeLessThan(1.6);
  });

  it("caps a single step so a backgrounded tab does not jump on return", async () => {
    let clock = Date.UTC(2026, 8, 17, 5, 0);
    const provider = new MockMarketDataProvider({ now: () => clock, random: () => 0.999999 });
    provider.setReferencePrice("SBIN", 600);

    clock += 6 * 60 * 60 * 1000; // six hours away
    const quote = await provider.getQuote("SBIN");

    // Even with a near-maximal random draw, one step stays a sane size.
    expect(Math.abs(quote.ltp - 600) / 600).toBeLessThan(0.05);
  });
});

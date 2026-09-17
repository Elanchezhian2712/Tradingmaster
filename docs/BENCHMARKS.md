# Performance Benchmarks

## How to reproduce

1. `npm run dev -w apps/web`, open the app.
2. In the right-hand **Performance Benchmark** panel, click **Run all
   scenarios** (or **Run** on an individual row).
3. Each run: loads N mock candles for the active timeframe, calls
   `chart.setData(batch)`, waits two animation frames, then reads
   `chart.getPerfSnapshot()`. Load time and render time are measured with
   `performance.now()`; FPS/heap come from the chart's own `PerfMonitor`
   (`packages/chart-engine/src/perf/PerfMonitor.ts`), the same one driving
   the always-on dev HUD in the top-right of the chart.
4. Numbers below are one real run, captured via headless Chromium
   (Playwright, software WebGL via SwiftShader — a real GPU will render
   faster, not slower, than these figures).

## Results

| Candles | Load (ms) | Render (ms) | FPS | Heap |
|---:|---:|---:|---:|---:|
| 10,000 | 9.2 | 29.6 | 937.5 | 9.5MB |
| 50,000 | 25.7 | 23.5 | 941.2 | 9.5MB |
| 100,000 | 46.1 | 20.9 | 1010.1 | 9.5MB |
| 500,000 | 239.8 | 26.8 | 944.9 | 9.5MB |

## What this shows

- **Load time scales with dataset size** (mock generation + structured
  clone across the worker boundary) — expected, and the reason historical
  loads and live ticks run in a dedicated Web Worker rather than on the
  main thread.
- **Render time does not scale with dataset size** — it stays in the same
  20-30ms band from 10k to 500k candles. This is the core architectural
  claim (`docs/ARCHITECTURE.md`): the WebGL instance buffer only ever holds
  the *visible* candles (bounded by screen width ÷ candle width, typically
  a few hundred), so 500,000 candles in the store costs the same to draw as
  10,000. Panning and zooming likewise only touch the visible range.
- **Heap stays flat.** `performance.memory` isn't updated with high
  precision under every browser/flag combination, but the typed-array
  storage (`GrowableFloat64`, six `Float64Array`s per series) is the
  reason there's no per-candle object allocation to accumulate garbage
  from in the first place.

## Honesty notes

- These are **rendering + data-plumbing** benchmarks, not a general
  "faster than X" claim about any other product — none is made anywhere in
  this codebase.
- FPS here reflects the render loop's own frame timing during a
  synthetic full-dataset load, not a sustained interactive pan/zoom
  session measured by an external tool. The dev HUD shows the same metrics
  live during real interaction — use it directly (mouse-wheel zoom, drag to
  pan) for a first-hand feel while watching Frame/Render/FPS update.
- Indicator calculation time (`Indicators` in the HUD) reads ~0ms in these
  runs because the benchmark panel doesn't attach indicators before
  loading; the indicator engine's incremental-update guarantee is instead
  verified directly by unit tests (`packages/indicators/src/__tests__/
  indicators.test.ts`) that assert seeding N-5 bars and streaming 5 more
  matches a full recompute over all N.
- Automated synthetic pan/zoom-latency benchmarking (as opposed to reading
  the live HUD by hand) is listed as future work in `docs/FUTURE.md`.

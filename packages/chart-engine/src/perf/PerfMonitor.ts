export interface PerfSnapshot {
  fps: number;
  lastFrameTimeMs: number;
  avgFrameTimeMs: number;
  renderTimeMs: number;
  indicatorTimeMs: number;
  visibleCandles: number;
  totalCandles: number;
  usedJSHeapMB: number | null;
}

const HISTORY_SIZE = 120;

/**
 * Lightweight sliding-window frame-time tracker. Cheap enough to update
 * every frame without itself becoming a performance problem.
 */
export class PerfMonitor {
  private frameTimes: number[] = [];
  private lastFrameStart = 0;
  private lastRenderTimeMs = 0;
  private lastIndicatorTimeMs = 0;
  private visibleCandles = 0;
  private totalCandles = 0;

  beginFrame(): void {
    this.lastFrameStart = performance.now();
  }

  endFrame(): void {
    const now = performance.now();
    const dt = now - this.lastFrameStart;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > HISTORY_SIZE) this.frameTimes.shift();
  }

  recordRenderTime(ms: number): void {
    this.lastRenderTimeMs = ms;
  }

  recordIndicatorTime(ms: number): void {
    this.lastIndicatorTimeMs = ms;
  }

  recordDatasetSize(visible: number, total: number): void {
    this.visibleCandles = visible;
    this.totalCandles = total;
  }

  snapshot(): PerfSnapshot {
    const n = this.frameTimes.length || 1;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / n;
    const last = this.frameTimes[this.frameTimes.length - 1] ?? 0;
    const fps = avg > 0 ? 1000 / avg : 0;

    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;

    return {
      fps: Math.round(fps * 10) / 10,
      lastFrameTimeMs: Math.round(last * 100) / 100,
      avgFrameTimeMs: Math.round(avg * 100) / 100,
      renderTimeMs: Math.round(this.lastRenderTimeMs * 100) / 100,
      indicatorTimeMs: Math.round(this.lastIndicatorTimeMs * 100) / 100,
      visibleCandles: this.visibleCandles,
      totalCandles: this.totalCandles,
      usedJSHeapMB: perfMemory ? Math.round((perfMemory.usedJSHeapSize / (1024 * 1024)) * 10) / 10 : null,
    };
  }
}

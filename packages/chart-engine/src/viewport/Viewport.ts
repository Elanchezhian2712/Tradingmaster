import { PaneRect, PaneSpec, computePaneLayout, TIME_AXIS_HEIGHT, PRICE_AXIS_WIDTH } from "./PaneLayout";
import { ScaleMode, fromScaleSpace, toScaleSpace } from "./scale";

export const MIN_CANDLE_WIDTH = 1.5;
export const MAX_CANDLE_WIDTH = 60;
export const DEFAULT_CANDLE_WIDTH = 7;
const DEFAULT_VISIBLE_CANDLES = 150;

export interface PriceRange {
  min: number;
  max: number;
}

export interface VisibleIndexRange {
  start: number;
  end: number;
}

/**
 * Owns everything needed to turn a data index / price into a pixel and
 * back: horizontal zoom/pan state, the plot-area pixel size, per-pane
 * vertical layout, and each pane's price scale. Pure state + math, no
 * DOM/GL — the renderers read from it every frame.
 */
export class Viewport {
  private plotWidth = 0;
  private plotHeight = 0;
  private dataLength = 0;

  private candleWidthPx = DEFAULT_CANDLE_WIDTH;
  /** Fractional data index that lines up with the right edge of the plot area. */
  private rightEdgeIndex = 0;

  private scaleMode: ScaleMode = "linear";
  private autoScale = true;
  private manualRange: PriceRange | null = null;
  private paneRanges = new Map<string, PriceRange>();
  private paneSpecs: PaneSpec[] = [{ id: "main", weight: 3, minHeight: 120 }];
  private paneRects: PaneRect[] = [];

  setContainerSize(width: number, height: number): void {
    this.plotWidth = Math.max(0, width - PRICE_AXIS_WIDTH);
    this.plotHeight = Math.max(0, height - TIME_AXIS_HEIGHT);
    this.recomputePaneRects();
  }

  setPaneSpecs(specs: PaneSpec[]): void {
    this.paneSpecs = specs;
    this.recomputePaneRects();
  }

  private recomputePaneRects(): void {
    this.paneRects = computePaneLayout(this.plotHeight, this.paneSpecs);
  }

  getPaneRects(): PaneRect[] {
    return this.paneRects;
  }

  getPaneRect(id: string): PaneRect | undefined {
    return this.paneRects.find((p) => p.id === id);
  }

  get width(): number {
    return this.plotWidth;
  }
  get height(): number {
    return this.plotHeight;
  }

  setDataLength(n: number, opts?: { keepRightEdge?: boolean }): void {
    const wasEmpty = this.dataLength === 0;
    this.dataLength = n;
    if (wasEmpty) {
      // First data the chart has ever seen: no prior zoom to preserve, pick a sensible default.
      this.resetView();
    } else if (opts?.keepRightEdge) {
      // A live tick/append/prepend against the same series: just keep bounds sane.
      this.clampRightEdge();
    } else {
      // A new dataset for an already-initialized chart (timeframe/symbol switch): keep
      // the user's current zoom level (candleWidthPx) instead of snapping back to the
      // default, and just recenter on the newest candles of the new series.
      const count = this.plotWidth / this.candleWidthPx;
      this.rightEdgeIndex = this.dataLength + count / 8;
      this.clampRightEdge();
    }
  }

  getDataLength(): number {
    return this.dataLength;
  }

  resetView(): void {
    const visibleCount = Math.min(DEFAULT_VISIBLE_CANDLES, Math.max(this.dataLength, 1));
    this.candleWidthPx = this.plotWidth > 0 ? clamp(this.plotWidth / visibleCount, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH) : DEFAULT_CANDLE_WIDTH;
    this.rightEdgeIndex = this.dataLength + this.plotWidth / this.candleWidthPx / 8;
  }

  fitAll(): void {
    if (this.dataLength === 0) return;
    this.candleWidthPx = clamp(this.plotWidth / this.dataLength, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH);
    this.rightEdgeIndex = this.dataLength;
  }

  visibleIndexRange(): VisibleIndexRange {
    const count = this.plotWidth / this.candleWidthPx;
    return { start: this.rightEdgeIndex - count, end: this.rightEdgeIndex };
  }

  getCandleWidth(): number {
    return this.candleWidthPx;
  }

  indexToX(index: number): number {
    const { start } = this.visibleIndexRange();
    return (index - start) * this.candleWidthPx;
  }

  xToIndex(x: number): number {
    const { start } = this.visibleIndexRange();
    return start + x / this.candleWidthPx;
  }

  panByPixels(dxPixels: number): void {
    this.rightEdgeIndex -= dxPixels / this.candleWidthPx;
    this.clampRightEdge();
  }

  zoomAtPixel(pixelX: number, factor: number): void {
    const idx = this.xToIndex(pixelX);
    const nextWidth = clamp(this.candleWidthPx * factor, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH);
    if (nextWidth === this.candleWidthPx) return;
    this.candleWidthPx = nextWidth;
    this.rightEdgeIndex = idx + (this.plotWidth - pixelX) / this.candleWidthPx;
    this.clampRightEdge();
  }

  private clampRightEdge(): void {
    const count = this.plotWidth / this.candleWidthPx;
    const minRightEdge = -count * 0.9;
    const maxRightEdge = this.dataLength + count * 0.9;
    this.rightEdgeIndex = clamp(this.rightEdgeIndex, minRightEdge, maxRightEdge);
  }

  setScaleMode(mode: ScaleMode): void {
    this.scaleMode = mode;
  }
  getScaleMode(): ScaleMode {
    return this.scaleMode;
  }

  setAutoScale(auto: boolean): void {
    this.autoScale = auto;
  }
  isAutoScale(): boolean {
    return this.autoScale;
  }

  setManualRange(range: PriceRange | null): void {
    this.manualRange = range;
  }

  /** Called by the renderer each frame to refresh a pane's auto-computed price bounds. */
  setPaneRange(paneId: string, range: PriceRange): void {
    if (paneId === "main" && !this.autoScale && this.manualRange) {
      this.paneRanges.set(paneId, this.manualRange);
      return;
    }
    const padded = padRange(range, 0.08);
    this.paneRanges.set(paneId, padded);
  }

  getPaneRange(paneId: string): PriceRange {
    return this.paneRanges.get(paneId) ?? { min: 0, max: 1 };
  }

  priceToY(price: number, paneId: string): number {
    const rect = this.getPaneRect(paneId);
    const range = this.getPaneRange(paneId);
    if (!rect) return 0;
    const basePrice = (range.min + range.max) / 2 || 1;
    const scaledPrice = toScaleSpace(price, paneId === "main" ? this.scaleMode : "linear", basePrice);
    const scaledMin = toScaleSpace(range.min, paneId === "main" ? this.scaleMode : "linear", basePrice);
    const scaledMax = toScaleSpace(range.max, paneId === "main" ? this.scaleMode : "linear", basePrice);
    const t = (scaledPrice - scaledMin) / (scaledMax - scaledMin || 1);
    return rect.top + rect.height * (1 - t);
  }

  yToPrice(y: number, paneId: string): number {
    const rect = this.getPaneRect(paneId);
    const range = this.getPaneRange(paneId);
    if (!rect) return 0;
    const basePrice = (range.min + range.max) / 2 || 1;
    const scaledMin = toScaleSpace(range.min, paneId === "main" ? this.scaleMode : "linear", basePrice);
    const scaledMax = toScaleSpace(range.max, paneId === "main" ? this.scaleMode : "linear", basePrice);
    const t = 1 - (y - rect.top) / rect.height;
    const scaled = scaledMin + t * (scaledMax - scaledMin);
    return fromScaleSpace(scaled, paneId === "main" ? this.scaleMode : "linear", basePrice);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function padRange(range: PriceRange, fraction: number): PriceRange {
  const span = range.max - range.min || Math.abs(range.max) || 1;
  const pad = span * fraction;
  return { min: range.min - pad, max: range.max + pad };
}

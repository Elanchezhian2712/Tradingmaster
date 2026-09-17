import { CandleBatch, CandleSnapshot, Timeframe } from "@trading-master/market-data";
import { CandleStore } from "./data/CandleStore";
import { DrawingManager, generateDrawingId } from "./drawings/DrawingManager";
import { DrawingObject, DrawingPoint, DrawingType, POINTS_REQUIRED } from "./drawings/types";
import { InteractionController } from "./interaction/InteractionController";
import { PerfMonitor, PerfSnapshot } from "./perf/PerfMonitor";
import { CrosshairState, IndicatorLineSpec, OverlayRenderer, PriceLine } from "./render/overlay/OverlayRenderer";
import { findDraggablePriceLine } from "./render/overlay/priceLineHitTest";
import { WebGLCandleRenderer } from "./render/webgl/WebGLCandleRenderer";
import { ChartTheme, ThemeName, resolveTheme } from "./theme";
import { PaneSpec } from "./viewport/PaneLayout";
import { ScaleMode } from "./viewport/scale";
import { Viewport } from "./viewport/Viewport";

export interface IndicatorPaneConfig {
  id: string;
  pane: "overlay" | "separate";
  lines: { key: string; color: string; style?: "line" | "histogram" }[];
  /** Fixed price-axis range for this pane (e.g. RSI/ADX are always 0-100); omit to auto-scale from visible data. */
  fixedRange?: { min: number; max: number };
}

type ChartEventMap = {
  crosshair: CandleSnapshot | null;
  perf: PerfSnapshot;
  drawingsChanged: DrawingObject[];
  needMoreHistory: undefined;
  /** Fires when an armed drawing tool finishes placing its shape and auto-disarms, so the UI can un-highlight it. */
  drawingToolDeactivated: undefined;
  /** A draggable price line was released at a new price. The chart does not apply it — the app decides what moving that line means. */
  priceLineMoved: { id: string; price: number };
};

const DRAG_CLICK_THRESHOLD_PX = 4;
/** How close the pointer has to be, vertically, to grab a price line. */
const PRICE_LINE_GRAB_PX = 5;

type Listener<T> = (payload: T) => void;

export interface ChartEngineOptions {
  theme?: ThemeName;
  symbol?: string;
  timeframe?: Timeframe;
}

/**
 * The chart's imperative core. Deliberately not a React component: React
 * mounts one instance in a ref and never re-renders it on data/indicator
 * changes — all high-frequency updates flow through this class's own
 * render loop instead of the React tree.
 */
export class ChartEngine {
  private store = new CandleStore();
  private viewport = new Viewport();
  private drawingManager = new DrawingManager();
  private perf = new PerfMonitor();

  private glCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private glRenderer: WebGLCandleRenderer;
  private overlayRenderer: OverlayRenderer;
  private interaction: InteractionController;

  private theme: ChartTheme;
  private timeframe: Timeframe;
  private symbol: string;

  private indicatorConfigs = new Map<string, IndicatorPaneConfig>();
  private indicatorOutputs = new Map<string, Record<string, Float64Array>>();
  private indicatorEnabled = new Map<string, boolean>();

  private priceLines: PriceLine[] = [];
  private draggedPriceLineId: string | null = null;

  private crosshair: CrosshairState | null = null;
  private armedDrawingType: DrawingType | null = null;
  private armedDrawingPoints: DrawingPoint[] = [];
  private armedDrawingColor = "#f0b90b";
  private drawingDragActive = false;
  private dragStartPoint: DrawingPoint | null = null;
  private magnetMode = false;
  private stayInDrawingMode = false;
  private lockAllDrawings = false;
  private hideDrawings = false;
  private cursorMode: "crosshair" | "dot" | "arrow" | "eraser" = "crosshair";

  private dirty = true;
  private historyLoading = false;
  private rafHandle: number | null = null;
  private dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  private listeners: { [K in keyof ChartEventMap]: Set<Listener<ChartEventMap[K]>> } = {
    crosshair: new Set(),
    perf: new Set(),
    drawingsChanged: new Set(),
    needMoreHistory: new Set(),
    drawingToolDeactivated: new Set(),
    priceLineMoved: new Set(),
  };

  constructor(private container: HTMLElement, options: ChartEngineOptions = {}) {
    this.theme = resolveTheme(options.theme ?? "dark");
    this.timeframe = options.timeframe ?? "5m";
    this.symbol = options.symbol ?? "NIFTY";

    container.style.position = "relative";
    container.style.overflow = "hidden";

    this.glCanvas = document.createElement("canvas");
    this.glCanvas.style.position = "absolute";
    this.glCanvas.style.left = "0";
    this.glCanvas.style.top = "0";
    container.appendChild(this.glCanvas);

    this.overlayCanvas = document.createElement("canvas");
    this.overlayCanvas.style.position = "absolute";
    this.overlayCanvas.style.left = "0";
    this.overlayCanvas.style.top = "0";
    this.overlayCanvas.style.pointerEvents = "none";
    container.appendChild(this.overlayCanvas);

    this.glRenderer = new WebGLCandleRenderer(this.glCanvas);
    this.overlayRenderer = new OverlayRenderer(this.overlayCanvas);

    this.viewport.setPaneSpecs(this.buildPaneSpecs());
    const rect = container.getBoundingClientRect();
    this.applySize(rect.width || 800, rect.height || 500);

    this.interaction = new InteractionController(container, {
      onDragStart: (x, y) => {
        if (this.cursorMode === "eraser") {
          const nearestId = this.drawingManager.findNearest(x, y, this.viewport);
          if (nearestId) {
            this.removeDrawing(nearestId);
          }
          return;
        }
        const hit = this.draggablePriceLineAt(x, y);
        if (!this.armedDrawingType && hit) {
          this.draggedPriceLineId = hit.id;
          return;
        }
        if (this.armedDrawingType) {
          const rawIdx = this.viewport.xToIndex(x);
          const rawPrice = this.viewport.yToPrice(y, "main");
          const pt = this.magnetMode ? this.snapToCandleOhlc(rawIdx, rawPrice) : { index: rawIdx, price: rawPrice };
          this.dragStartPoint = pt;
          this.drawingDragActive = true;
        }
      },
      onDragMove: (x, y, dx) => {
        if (this.draggedPriceLineId) {
          this.movePriceLinePreview(this.draggedPriceLineId, this.viewport.yToPrice(y, "main"));
          return;
        }
        if (this.drawingDragActive) {
          this.requestRender(); // crosshair (tracked separately below) drives the live preview shape
        } else {
          this.viewport.panByPixels(dx);
          this.requestRender();
        }
      },
      onDragEnd: (x, y) => {
        if (this.draggedPriceLineId) {
          const id = this.draggedPriceLineId;
          this.draggedPriceLineId = null;
          const line = this.priceLines.find((l) => l.id === id);
          if (line) this.emit("priceLineMoved", { id, price: this.viewport.yToPrice(y, "main") });
          return;
        }
        if (!this.drawingDragActive) return;
        this.drawingDragActive = false;
        const start = this.dragStartPoint;
        this.dragStartPoint = null;
        if (!start) return;

        const dx = x - (this.viewport.indexToX(start.index) + this.viewport.getCandleWidth() / 2);
        const dy = y - this.viewport.priceToY(start.price, "main");
        if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
          // A genuine drag: the press and release positions become the shape's first two points.
          this.addDrawingPoint(start.index, start.price);
          this.addDrawingPoint(this.viewport.xToIndex(x), this.viewport.yToPrice(y, "main"));
        } else {
          // Negligible movement: treat as a plain click, the same as the click-click flow.
          this.addDrawingPoint(this.viewport.xToIndex(x), this.viewport.yToPrice(y, "main"));
        }
        this.requestRender();
      },
      onZoom: (x, factor) => {
        this.viewport.zoomAtPixel(x, factor);
        this.requestRender();
      },
      onCrosshairMove: (x, y) => {
        if (!this.draggedPriceLineId) {
          container.style.cursor = !this.armedDrawingType && this.draggablePriceLineAt(x, y) ? "ns-resize" : "";
        }
        this.crosshair = { x, y, paneId: this.paneIdAtY(y) };
        this.emitCrosshair();
        this.requestRender();
      },
      onCrosshairLeave: () => {
        this.crosshair = null;
        this.emit("crosshair", null);
        this.requestRender();
      },
      onResize: (w, h) => this.applySize(w, h),
      onDoubleClick: () => this.fitAll(),
    });

    this.startLoop();
  }

  // ---- data ----

  setData(batch: CandleBatch): void {
    this.store.setData(batch);
    this.viewport.setDataLength(this.store.length);
    this.requestRender();
  }

  prependData(batch: CandleBatch): void {
    this.store.prependData(batch);
    this.viewport.setDataLength(this.store.length, { keepRightEdge: true });
    this.requestRender();
  }

  pushBar(bar: CandleSnapshot): void {
    this.store.pushBar(bar);
    this.viewport.setDataLength(this.store.length, { keepRightEdge: true });
    this.requestRender();
  }

  updateLastBar(bar: CandleSnapshot): void {
    this.store.replaceLast(bar);
    this.requestRender();
  }

  getCandleCount(): number {
    return this.store.length;
  }

  getSeriesView() {
    return this.store.toSeriesView();
  }

  /** Call with `true` right before requesting older history and `false` once it's merged in, to avoid duplicate requests. */
  setHistoryLoading(loading: boolean): void {
    this.historyLoading = loading;
  }

  setTimeframe(tf: Timeframe): void {
    this.timeframe = tf;
    this.requestRender();
  }

  // ---- indicators ----

  setIndicatorPane(config: IndicatorPaneConfig, output: Record<string, Float64Array>): void {
    this.indicatorConfigs.set(config.id, config);
    this.indicatorOutputs.set(config.id, output);
    if (!this.indicatorEnabled.has(config.id)) this.indicatorEnabled.set(config.id, true);
    this.viewport.setPaneSpecs(this.buildPaneSpecs());
    this.requestRender();
  }

  updateIndicatorOutput(id: string, output: Record<string, Float64Array>): void {
    this.indicatorOutputs.set(id, output);
    this.requestRender();
  }

  setIndicatorEnabled(id: string, enabled: boolean): void {
    this.indicatorEnabled.set(id, enabled);
    this.viewport.setPaneSpecs(this.buildPaneSpecs());
    this.requestRender();
  }

  removeIndicator(id: string): void {
    this.indicatorConfigs.delete(id);
    this.indicatorOutputs.delete(id);
    this.indicatorEnabled.delete(id);
    this.viewport.setPaneSpecs(this.buildPaneSpecs());
    this.requestRender();
  }

  private buildPaneSpecs(): PaneSpec[] {
    const specs: PaneSpec[] = [{ id: "main", weight: 3, minHeight: 140 }];
    specs.push({ id: "volume", weight: 1, minHeight: 60 });
    for (const config of this.indicatorConfigs.values()) {
      if (config.pane !== "separate") continue;
      if (this.indicatorEnabled.get(config.id) === false) continue;
      specs.push({ id: config.id, weight: 1, minHeight: 70 });
    }
    return specs;
  }

  // ---- price lines ----

  /**
   * Replace the horizontal levels drawn on the main pane (position entries,
   * resting orders, alerts). The whole set is replaced at once because the
   * caller owns the list, and a full swap is cheaper than diffing a handful
   * of lines.
   */
  setPriceLines(lines: PriceLine[]): void {
    const dragged = this.draggedPriceLineId ? this.priceLines.find((l) => l.id === this.draggedPriceLineId) : undefined;
    // A refresh mid-drag must not snap the line back to the price the app still
    // has on record — the pointer is the source of truth until it is released.
    this.priceLines = dragged ? lines.map((l) => (l.id === dragged.id ? { ...l, price: dragged.price } : l)) : lines;
    this.requestRender();
  }

  /** The draggable price line under the pointer, if any. Only the main pane carries them. */
  private draggablePriceLineAt(x: number, y: number): PriceLine | null {
    if (x > this.viewport.width) return null;
    const mainRect = this.viewport.getPaneRect("main");
    if (!mainRect || y < mainRect.top || y > mainRect.top + mainRect.height) return null;

    return findDraggablePriceLine(this.priceLines, y, (price) => this.viewport.priceToY(price, "main"), PRICE_LINE_GRAB_PX);
  }

  private movePriceLinePreview(id: string, price: number): void {
    this.priceLines = this.priceLines.map((l) => (l.id === id ? { ...l, price } : l));
    this.requestRender();
  }

  getPriceLines(): PriceLine[] {
    return this.priceLines;
  }

  // ---- view controls ----

  setTheme(name: ThemeName): void {
    this.theme = resolveTheme(name);
    this.requestRender();
  }

  setScaleMode(mode: ScaleMode): void {
    this.viewport.setScaleMode(mode);
    this.requestRender();
  }

  setAutoScale(auto: boolean): void {
    this.viewport.setAutoScale(auto);
    this.requestRender();
  }

  resetView(): void {
    this.viewport.resetView();
    this.requestRender();
  }

  fitAll(): void {
    this.viewport.fitAll();
    this.requestRender();
  }

  // ---- drawing tools ----

  armDrawingTool(type: DrawingType | null, color = "#f0b90b"): void {
    this.armedDrawingType = type;
    this.armedDrawingColor = color;
    this.armedDrawingPoints = [];
    this.drawingDragActive = false;
    this.dragStartPoint = null;
    this.requestRender();
  }

  private snapToCandleOhlc(index: number, rawPrice: number): { index: number; price: number } {
    const bar = this.store.barAt(Math.round(index));
    if (!bar) return { index, price: rawPrice };
    const candidates = [bar.open, bar.high, bar.low, bar.close];
    let closest = candidates[0]!;
    let minDist = Math.abs(rawPrice - closest);
    for (let i = 1; i < candidates.length; i++) {
      const dist = Math.abs(rawPrice - candidates[i]!);
      if (dist < minDist) {
        minDist = dist;
        closest = candidates[i]!;
      }
    }
    return { index: Math.round(index), price: closest };
  }

  /**
   * Adds one point to the drawing currently being placed. Called once per
   * plain click, or twice in a row (start + end) when the user instead
   * presses, drags, and releases in one motion — see ChartEngine's
   * `onDragEnd` wiring in the constructor.
   */
  private addDrawingPoint(rawIndex: number, rawPrice: number): void {
    if (!this.armedDrawingType) return;
    const pt = this.magnetMode ? this.snapToCandleOhlc(rawIndex, rawPrice) : { index: rawIndex, price: rawPrice };
    this.armedDrawingPoints.push(pt);

    const required = POINTS_REQUIRED[this.armedDrawingType];
    if (this.armedDrawingPoints.length >= required) {
      const text = this.armedDrawingType === "text" || this.armedDrawingType === "callout" ? window.prompt("Label text:") ?? "" : undefined;
      this.drawingManager.add(this.armedDrawingType, this.armedDrawingPoints, this.armedDrawingColor, 1.5, text);
      if (!this.stayInDrawingMode) {
        this.armedDrawingType = null;
        this.emit("drawingToolDeactivated", undefined);
      }
      this.armedDrawingPoints = [];
      this.emit("drawingsChanged", this.drawingManager.list());
    }
  }

  setMagnetMode(enabled: boolean): void {
    this.magnetMode = enabled;
  }

  isMagnetMode(): boolean {
    return this.magnetMode;
  }

  setStayInDrawingMode(enabled: boolean): void {
    this.stayInDrawingMode = enabled;
  }

  isStayInDrawingMode(): boolean {
    return this.stayInDrawingMode;
  }

  setLockAllDrawings(locked: boolean): void {
    this.lockAllDrawings = locked;
    this.drawingManager.setAllLocked(locked);
    this.requestRender();
  }

  isLockAllDrawings(): boolean {
    return this.lockAllDrawings;
  }

  setHideDrawings(hidden: boolean): void {
    this.hideDrawings = hidden;
    this.requestRender();
  }

  isHideDrawings(): boolean {
    return this.hideDrawings;
  }

  setCursorMode(mode: "crosshair" | "dot" | "arrow" | "eraser"): void {
    this.cursorMode = mode;
    if (mode === "eraser") {
      this.container.style.cursor = "crosshair";
    } else if (mode === "arrow") {
      this.container.style.cursor = "default";
    } else {
      this.container.style.cursor = "crosshair";
    }
  }

  getCursorMode(): "crosshair" | "dot" | "arrow" | "eraser" {
    return this.cursorMode;
  }

  /** Live "rubber band" preview from the armed drawing's committed points through the current cursor position. */
  private buildDrawingPreview(): DrawingObject | null {
    if (!this.armedDrawingType) return null;
    const points = [...this.armedDrawingPoints];
    if (this.drawingDragActive && this.dragStartPoint) points.push(this.dragStartPoint);
    if (this.crosshair) {
      points.push({ index: this.viewport.xToIndex(this.crosshair.x), price: this.viewport.yToPrice(this.crosshair.y, "main") });
    }
    if (points.length < 2) return null;
    return { id: "__preview__", type: this.armedDrawingType, points, color: this.armedDrawingColor, lineWidth: 1 };
  }

  removeDrawing(id: string): void {
    this.drawingManager.remove(id);
    this.emit("drawingsChanged", this.drawingManager.list());
    this.requestRender();
  }

  listDrawings(): DrawingObject[] {
    return this.drawingManager.list();
  }

  clearDrawings(): void {
    this.drawingManager.clear();
    this.emit("drawingsChanged", []);
    this.requestRender();
  }

  // ---- events ----

  on<K extends keyof ChartEventMap>(event: K, listener: Listener<ChartEventMap[K]>): () => void {
    this.listeners[event].add(listener as Listener<ChartEventMap[K]>);
    return () => this.listeners[event].delete(listener as Listener<ChartEventMap[K]>);
  }

  private emit<K extends keyof ChartEventMap>(event: K, payload: ChartEventMap[K]): void {
    for (const l of this.listeners[event]) l(payload);
  }

  private emitCrosshair(): void {
    if (!this.crosshair) {
      this.emit("crosshair", null);
      return;
    }
    const index = Math.round(this.viewport.xToIndex(this.crosshair.x));
    this.emit("crosshair", this.store.barAt(index));
  }

  // ---- sizing / render loop ----

  private applySize(width: number, height: number): void {
    this.viewport.setContainerSize(width, height);
    const totalPaneHeight = this.viewport.height;
    this.glRenderer.resize(this.viewport.width, totalPaneHeight, this.dpr);
    this.overlayRenderer.resize(width, height, this.dpr);
    this.requestRender();
  }

  private paneIdAtY(y: number): string {
    for (const rect of this.viewport.getPaneRects()) {
      if (y >= rect.top && y <= rect.top + rect.height) return rect.id;
    }
    return "main";
  }

  requestRender(): void {
    this.dirty = true;
  }

  private startLoop(): void {
    const loop = () => {
      if (this.dirty) {
        this.dirty = false;
        this.renderFrame();
      }
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  private renderFrame(): void {
    this.perf.beginFrame();
    const t0 = performance.now();

    if (this.store.length > 0) {
      const { start, end } = this.viewport.visibleIndexRange();
      const priceRange = this.store.priceRange(start, end);
      this.viewport.setPaneRange("main", priceRange);
      if (!this.historyLoading && start < 50) {
        this.emit("needMoreHistory", undefined);
      }
    }

    this.glRenderer.clear(hexBg(this.theme.background));
    if (this.store.length > 0) {
      this.glRenderer.renderCandles(this.store, this.viewport, this.theme, "volume");
    }

    const indicatorLines: IndicatorLineSpec[] = [];
    for (const config of this.indicatorConfigs.values()) {
      if (this.indicatorEnabled.get(config.id) === false) continue;
      const output = this.indicatorOutputs.get(config.id);
      if (!output) continue;
      const paneId = config.pane === "overlay" ? "main" : config.id;
      if (config.pane === "separate") {
        if (config.fixedRange) this.viewport.setPaneRange(config.id, config.fixedRange);
        else this.autoScaleIndicatorPane(config.id, output);
      }
      for (const line of config.lines) {
        const values = output[line.key];
        if (!values) continue;
        indicatorLines.push({ id: config.id, paneId, key: line.key, color: line.color, values, style: line.style });
      }
    }

    this.overlayRenderer.render({
      store: this.store,
      viewport: this.viewport,
      theme: this.theme,
      timeframe: this.timeframe,
      indicatorLines,
      priceLines: this.priceLines,
      crosshair: this.crosshair,
      drawings: this.drawingManager.list(),
      activeDrawingPreview: this.buildDrawingPreview(),
      hideDrawings: this.hideDrawings,
    });

    const renderTime = performance.now() - t0;
    this.perf.recordRenderTime(renderTime);
    const visibleRange = this.viewport.visibleIndexRange();
    const visibleCount = Math.max(0, Math.min(this.store.length, visibleRange.end) - Math.max(0, visibleRange.start));
    this.perf.recordDatasetSize(visibleCount, this.store.length);
    this.perf.endFrame();
    this.emit("perf", this.perf.snapshot());
  }

  private autoScaleIndicatorPane(id: string, output: Record<string, Float64Array>): void {
    const { start, end } = this.viewport.visibleIndexRange();
    const s = Math.max(0, Math.floor(start));
    const e = Math.min(this.store.length - 1, Math.ceil(end));
    let min = Infinity;
    let max = -Infinity;
    for (const values of Object.values(output)) {
      for (let i = s; i <= e; i++) {
        const v = values[i];
        if (v === undefined || Number.isNaN(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    this.viewport.setPaneRange(id, { min, max });
  }

  getPerfSnapshot(): PerfSnapshot {
    return this.perf.snapshot();
  }

  dispose(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.interaction.dispose();
    this.glRenderer.dispose();
    this.container.removeChild(this.glCanvas);
    this.container.removeChild(this.overlayCanvas);
  }
}

function hexBg(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export { generateDrawingId };

import { CandleStore } from "../../data/CandleStore";
import { DrawingObject } from "../../drawings/types";
import { renderDrawing } from "../../drawings/renderDrawing";
import { Timeframe } from "@trading-master/market-data";
import { ChartTheme } from "../../theme";
import { PRICE_AXIS_WIDTH, TIME_AXIS_HEIGHT } from "../../viewport/PaneLayout";
import { Viewport } from "../../viewport/Viewport";
import { formatPrice, formatTimeForTimeframe, formatDateTimeFull, formatVolume } from "./format";

export interface IndicatorLineSpec {
  id: string;
  paneId: string;
  key: string;
  color: string;
  values: Float64Array;
  style?: "line" | "histogram";
}

export interface CrosshairState {
  x: number;
  y: number;
  paneId: string;
}

/**
 * A horizontal level drawn across the main pane with a label in the price
 * gutter — position entry prices, resting order levels, alert levels. The
 * chart knows nothing about what a line means; the app supplies text and colour.
 */
export interface PriceLine {
  id: string;
  price: number;
  color: string;
  /** Short text for the price-axis gutter, e.g. "LONG 10" or "SL". */
  label: string;
  style?: "solid" | "dashed";
  /** Draggable lines can be moved with the pointer; the chart reports the new price and the app decides what it means. */
  draggable?: boolean;
}

export interface OverlayRenderParams {
  store: CandleStore;
  viewport: Viewport;
  theme: ChartTheme;
  timeframe: Timeframe;
  indicatorLines: IndicatorLineSpec[];
  priceLines: PriceLine[];
  crosshair: CrosshairState | null;
  drawings: DrawingObject[];
  activeDrawingPreview: DrawingObject | null;
}

const PRICE_GRID_LINES = 5;

export class OverlayRenderer {
  private ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(p: OverlayRenderParams): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    const plotWidth = p.viewport.width;
    const plotHeight = p.viewport.height;

    this.drawPanesGridAndAxes(p, plotWidth, plotHeight);
    this.drawIndicatorLines(p);
    this.drawPriceLines(p, plotWidth);
    for (const d of p.drawings) renderDrawing(ctx, d, p.viewport, p.theme);
    if (p.activeDrawingPreview) renderDrawing(ctx, p.activeDrawingPreview, p.viewport, p.theme);
    if (p.crosshair) this.drawCrosshairLines(p, plotWidth, plotHeight);

    // Axis gutter backgrounds, painted over the plot content edge.
    ctx.fillStyle = p.theme.background;
    ctx.fillRect(plotWidth, 0, PRICE_AXIS_WIDTH, this.cssHeight);
    ctx.fillRect(0, plotHeight, plotWidth, TIME_AXIS_HEIGHT);
    this.drawAxisLabelsOverGutters(p, plotWidth, plotHeight);

    // Everything that writes *into* a gutter has to come after those fills,
    // or it gets painted over by them.
    this.drawPriceLineLabels(p, plotWidth, plotHeight);
    if (p.crosshair) this.drawCrosshairLabels(p, plotWidth, plotHeight);
  }

  private drawPanesGridAndAxes(p: OverlayRenderParams, plotWidth: number, plotHeight: number): void {
    const ctx = this.ctx;
    const { theme } = p;
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;

    for (const rect of p.viewport.getPaneRects()) {
      const range = p.viewport.getPaneRange(rect.id);
      for (let g = 0; g <= PRICE_GRID_LINES; g++) {
        const price = range.min + ((range.max - range.min) * g) / PRICE_GRID_LINES;
        const y = p.viewport.priceToY(price, rect.id);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
      }
      // Pane separator.
      ctx.strokeStyle = theme.axisBorderColor;
      ctx.beginPath();
      ctx.moveTo(0, rect.top + rect.height);
      ctx.lineTo(plotWidth, rect.top + rect.height);
      ctx.stroke();
      ctx.strokeStyle = theme.gridColor;
    }

    const step = this.timeTickStep(p.viewport);
    const { start, end } = p.viewport.visibleIndexRange();
    const first = Math.ceil(Math.max(0, start) / step) * step;
    for (let i = first; i <= end && i < p.store.length; i += step) {
      const x = p.viewport.indexToX(i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotHeight);
      ctx.stroke();
    }
  }

  private timeTickStep(viewport: Viewport): number {
    const desiredPxPerLabel = 90;
    return Math.max(1, Math.round(desiredPxPerLabel / viewport.getCandleWidth()));
  }

  private drawAxisLabelsOverGutters(p: OverlayRenderParams, plotWidth: number, plotHeight: number): void {
    const ctx = this.ctx;
    const { theme } = p;
    ctx.font = `11px ${theme.fontFamily}`;
    ctx.fillStyle = theme.textColor;
    ctx.textBaseline = "middle";

    const paneRects = p.viewport.getPaneRects();
    paneRects.forEach((rect, paneIndex) => {
      const range = p.viewport.getPaneRange(rect.id);
      const isLastPane = paneIndex === paneRects.length - 1;
      for (let g = 0; g <= PRICE_GRID_LINES; g++) {
        // g=0 sits at this pane's bottom edge, which is also the next pane's top
        // edge (g=PRICE_GRID_LINES there) — skip it here to avoid drawing both.
        if (g === 0 && !isLastPane) continue;
        const price = range.min + ((range.max - range.min) * g) / PRICE_GRID_LINES;
        const y = p.viewport.priceToY(price, rect.id);
        const label = rect.id === "volume" ? formatVolume(price) : formatPrice(price);
        ctx.fillText(label, plotWidth + 6, y);
      }
    });

    ctx.textBaseline = "top";
    const step = this.timeTickStep(p.viewport);
    const { start, end } = p.viewport.visibleIndexRange();
    const first = Math.ceil(Math.max(0, start) / step) * step;
    for (let i = first; i <= end && i < p.store.length; i += step) {
      const bar = p.store.barAt(Math.round(i));
      if (!bar) continue;
      const x = p.viewport.indexToX(i);
      const label = formatTimeForTimeframe(bar.time, p.timeframe);
      ctx.fillText(label, x - 14, plotHeight + 8);
    }
  }

  private drawIndicatorLines(p: OverlayRenderParams): void {
    const ctx = this.ctx;
    const { start, end } = p.viewport.visibleIndexRange();
    const firstIdx = Math.max(0, Math.floor(start));
    const lastIdx = Math.min(p.store.length - 1, Math.ceil(end));
    if (firstIdx > lastIdx) return;

    for (const line of p.indicatorLines) {
      if (line.style === "histogram") {
        ctx.fillStyle = line.color;
        const barW = Math.max(1, p.viewport.getCandleWidth() * 0.6);
        const zeroY = p.viewport.priceToY(0, line.paneId);
        for (let i = firstIdx; i <= lastIdx; i++) {
          const v = line.values[i];
          if (v === undefined || Number.isNaN(v)) continue;
          const x = p.viewport.indexToX(i) + p.viewport.getCandleWidth() / 2 - barW / 2;
          const y = p.viewport.priceToY(v, line.paneId);
          const top = Math.min(y, zeroY);
          const h = Math.max(1, Math.abs(zeroY - y));
          ctx.fillRect(x, top, barW, h);
        }
        continue;
      }

      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = firstIdx; i <= lastIdx; i++) {
        const v = line.values[i];
        if (v === undefined || Number.isNaN(v)) {
          started = false;
          continue;
        }
        const x = p.viewport.indexToX(i) + p.viewport.getCandleWidth() / 2;
        const y = p.viewport.priceToY(v, line.paneId);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  /** Horizontal levels on the main pane. Drawn under the drawings and crosshair. */
  private drawPriceLines(p: OverlayRenderParams, plotWidth: number): void {
    if (p.priceLines.length === 0) return;
    const ctx = this.ctx;
    const mainRect = p.viewport.getPaneRect("main");
    if (!mainRect) return;

    ctx.lineWidth = 1;
    ctx.font = `10px ${p.theme.fontFamily}`;
    ctx.textBaseline = "middle";

    for (const line of p.priceLines) {
      const y = p.viewport.priceToY(line.price, "main");
      if (y < mainRect.top || y > mainRect.top + mainRect.height) continue;

      ctx.strokeStyle = line.color;
      ctx.setLineDash(line.style === "dashed" ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // The descriptive part of the label sits inside the plot: the price gutter
      // is only 68px wide and would clip anything longer than the price itself.
      const chipWidth = ctx.measureText(line.label).width + 10;
      ctx.fillStyle = line.color;
      ctx.fillRect(0, y - 8, chipWidth, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line.label, 5, y);
    }
    ctx.setLineDash([]);
  }

  private drawPriceLineLabels(p: OverlayRenderParams, plotWidth: number, plotHeight: number): void {
    if (p.priceLines.length === 0) return;
    const ctx = this.ctx;
    const mainRect = p.viewport.getPaneRect("main");
    if (!mainRect) return;

    ctx.font = `10px ${p.theme.fontFamily}`;
    ctx.textBaseline = "middle";
    const top = mainRect.top;
    const bottom = mainRect.top + mainRect.height;
    const LABEL_HEIGHT = 17;
    let stackedAbove = 0;
    let stackedBelow = 0;

    for (const line of p.priceLines) {
      const y = p.viewport.priceToY(line.price, "main");
      const above = y < top;
      const below = y > bottom;
      // A level outside the visible range still matters — a stop-loss you
      // cannot see is exactly the one you want to know about — so its label is
      // pinned to the edge it went past, dimmed, with an arrow. Several levels
      // past the same edge stack instead of overprinting each other.
      const labelY = above
        ? top + 9 + stackedAbove++ * LABEL_HEIGHT
        : below
          ? bottom - 9 - stackedBelow++ * LABEL_HEIGHT
          : y;
      const arrow = above ? " ↑" : below ? " ↓" : "";

      ctx.globalAlpha = arrow ? 0.7 : 1;
      const h = 16;
      ctx.fillStyle = line.color;
      ctx.fillRect(plotWidth, labelY - h / 2, PRICE_AXIS_WIDTH, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${formatPrice(line.price)}${arrow}`, plotWidth + 4, labelY);
      ctx.globalAlpha = 1;
    }
    void plotHeight;
  }

  private drawCrosshairLines(p: OverlayRenderParams, plotWidth: number, plotHeight: number): void {
    const ctx = this.ctx;
    const { theme, crosshair } = p;
    if (!crosshair) return;
    ctx.strokeStyle = theme.crosshairColor;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(crosshair.x, 0);
    ctx.lineTo(crosshair.x, plotHeight);
    ctx.stroke();

    if (p.viewport.getPaneRect(crosshair.paneId)) {
      ctx.beginPath();
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(plotWidth, crosshair.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const bar = p.store.barAt(Math.round(p.viewport.xToIndex(crosshair.x)));
    if (bar) this.drawTooltip(crosshair.x, bar, p);
  }

  private drawCrosshairLabels(p: OverlayRenderParams, plotWidth: number, plotHeight: number): void {
    const { theme, crosshair } = p;
    if (!crosshair) return;

    if (p.viewport.getPaneRect(crosshair.paneId)) {
      const price = p.viewport.yToPrice(crosshair.y, crosshair.paneId);
      const label = crosshair.paneId === "volume" ? formatVolume(price) : formatPrice(price);
      this.drawLabelBox(plotWidth, crosshair.y, label, theme, "right");
    }

    const bar = p.store.barAt(Math.round(p.viewport.xToIndex(crosshair.x)));
    if (bar) {
      this.drawLabelBox(crosshair.x, plotHeight, formatTimeForTimeframe(bar.time, p.timeframe), theme, "bottom");
    }
  }

  private drawLabelBox(x: number, y: number, text: string, theme: ChartTheme, anchor: "right" | "bottom"): void {
    const ctx = this.ctx;
    ctx.font = `11px ${theme.fontFamily}`;
    const paddingX = 6;
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = theme.crosshairLabelBg;
    if (anchor === "right") {
      const h = 18;
      ctx.fillRect(x, y - h / 2, PRICE_AXIS_WIDTH, h);
      ctx.fillStyle = theme.crosshairLabelText;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + paddingX, y);
    } else {
      const w = textWidth + paddingX * 2;
      ctx.fillRect(x - w / 2, y, w, TIME_AXIS_HEIGHT - 2);
      ctx.fillStyle = theme.crosshairLabelText;
      ctx.textBaseline = "top";
      ctx.fillText(text, x - w / 2 + paddingX, y + 7);
    }
  }

  private drawTooltip(x: number, bar: { time: number; open: number; high: number; low: number; close: number; volume: number }, p: OverlayRenderParams): void {
    const ctx = this.ctx;
    const { theme } = p;
    const lines = [
      formatDateTimeFull(bar.time),
      `O ${formatPrice(bar.open)}  H ${formatPrice(bar.high)}`,
      `L ${formatPrice(bar.low)}  C ${formatPrice(bar.close)}`,
      `Vol ${formatVolume(bar.volume)}`,
    ];
    ctx.font = `11px ${theme.fontFamily}`;
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
    const height = lines.length * 16 + 10;
    const boxX = Math.min(Math.max(0, x + 12), p.viewport.width - width);
    const boxY = 8;

    ctx.fillStyle = theme.tooltipBg;
    ctx.fillRect(boxX, boxY, width, height);
    ctx.strokeStyle = theme.axisBorderColor;
    ctx.strokeRect(boxX, boxY, width, height);

    ctx.fillStyle = theme.tooltipText;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, boxX + 8, boxY + 6 + i * 16);
    });
  }
}

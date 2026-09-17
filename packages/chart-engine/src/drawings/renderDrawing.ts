import { ChartTheme } from "../theme";
import { Viewport } from "../viewport/Viewport";
import { DrawingObject, FIB_EXTENSION_LEVELS, FIB_RETRACEMENT_LEVELS } from "./types";

const PANE = "main";

function toXY(viewport: Viewport, index: number, price: number): [number, number] {
  return [viewport.indexToX(index) + viewport.getCandleWidth() / 2, viewport.priceToY(price, PANE)];
}

export function renderDrawing(ctx: CanvasRenderingContext2D, d: DrawingObject, viewport: Viewport, theme: ChartTheme): void {
  ctx.save();
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = d.lineWidth;
  ctx.font = `11px ${theme.fontFamily}`;

  switch (d.type) {
    case "horizontal-line": {
      const [, y] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      line(ctx, 0, y, viewport.width, y);
      break;
    }
    case "vertical-line": {
      const [x] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      line(ctx, x, 0, x, viewport.height);
      break;
    }
    case "trend-line": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      line(ctx, x1, y1, x2, y2);
      break;
    }
    case "ray": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      const dx = x2 - x1;
      if (Math.abs(dx) < 1e-6) {
        line(ctx, x1, y1, x1, y2 >= y1 ? viewport.height : 0);
      } else {
        const slope = (y2 - y1) / dx;
        const endX = viewport.width;
        const endY = y1 + slope * (endX - x1);
        line(ctx, x1, y1, endX, endY);
      }
      break;
    }
    case "arrow": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      line(ctx, x1, y1, x2, y2);
      drawArrowHead(ctx, x1, y1, x2, y2);
      break;
    }
    case "rectangle": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.globalAlpha = 1;
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    }
    case "horizontal-channel": {
      const [xa, ya] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [xb, yb] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      const offsetPrice = d.points[2]?.price ?? d.points[1]!.price;
      const [, yOffset] = toXY(viewport, d.points[1]!.index, offsetPrice);
      line(ctx, xa, ya, xb, yb);
      line(ctx, xa, ya + (yOffset - yb), xb, yOffset);
      break;
    }
    case "fib-retracement":
    case "fib-extension": {
      const levels = d.type === "fib-retracement" ? FIB_RETRACEMENT_LEVELS : FIB_EXTENSION_LEVELS;
      const p0 = d.points[0]!;
      const p1 = d.points[1]!;
      const x0 = toXY(viewport, p0.index, p0.price)[0];
      const x1 = toXY(viewport, p1.index, p1.price)[0];
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      for (const level of levels) {
        const price = p0.price + (p1.price - p0.price) * level;
        const y = viewport.priceToY(price, PANE);
        ctx.globalAlpha = 0.6;
        line(ctx, left, y, right, y);
        ctx.globalAlpha = 1;
        ctx.fillText(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, right + 4, y - 6);
      }
      break;
    }
    case "text": {
      const [x, y] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      ctx.fillText(d.text ?? "", x, y);
      break;
    }
    case "price-range": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      line(ctx, x1, y1, x1, y2);
      const diff = d.points[1]!.price - d.points[0]!.price;
      const pct = (diff / d.points[0]!.price) * 100;
      ctx.fillText(`${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct.toFixed(2)}%)`, Math.max(x1, x2) + 6, (y1 + y2) / 2);
      break;
    }
    case "date-range": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      line(ctx, x1, (y1 + y2) / 2, x2, (y1 + y2) / 2);
      const bars = Math.abs(d.points[1]!.index - d.points[0]!.index);
      ctx.fillText(`${bars} bars`, (x1 + x2) / 2 - 20, Math.min(y1, y2) - 10);
      break;
    }
  }
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 8;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

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
    case "horizontal-ray": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      line(ctx, x1, y1, viewport.width, y1);
      break;
    }
    case "circle": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      const radius = Math.hypot(x2 - x1, y2 - y1);
      ctx.beginPath();
      ctx.arc(x1, y1, radius, 0, Math.PI * 2);
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      break;
    }
    case "parallel-channel": {
      const [xa, ya] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [xb, yb] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      const offsetPrice = d.points[2]?.price ?? d.points[1]!.price;
      const [, yOffset] = toXY(viewport, d.points[1]!.index, offsetPrice);
      const dy = yOffset - yb;
      line(ctx, xa, ya, xb, yb);
      line(ctx, xa, ya + dy, xb, yb + dy);
      // Midline dashed
      ctx.setLineDash([4, 4]);
      line(ctx, xa, ya + dy / 2, xb, yb + dy / 2);
      ctx.setLineDash([]);
      // Channel fill
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.lineTo(xb, yb + dy);
      ctx.lineTo(xa, ya + dy);
      ctx.closePath();
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "brush":
    case "highlighter": {
      const isHighlighter = d.type === "highlighter";
      ctx.lineWidth = isHighlighter ? 8 : d.lineWidth || 2;
      ctx.globalAlpha = isHighlighter ? 0.35 : 0.9;
      if (d.points.length > 1) {
        ctx.beginPath();
        const [firstX, firstY] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
        ctx.moveTo(firstX, firstY);
        for (let i = 1; i < d.points.length; i++) {
          const [px, py] = toXY(viewport, d.points[i]!.index, d.points[i]!.price);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case "long-position": {
      const p0 = d.points[0]!;
      const p1 = d.points[1]!;
      const [x0, y0] = toXY(viewport, p0.index, p0.price);
      const [x1, y1] = toXY(viewport, p1.index, p1.price);
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1) + Math.max(60, Math.abs(x1 - x0));
      const entryPrice = p0.price;
      // Stop is below entry, target is above entry
      const stopPrice = Math.min(p0.price, p1.price);
      const targetPrice = entryPrice + Math.abs(entryPrice - stopPrice) * 2;
      const [, yStop] = toXY(viewport, p0.index, stopPrice);
      const [, yTarget] = toXY(viewport, p0.index, targetPrice);

      // Profit area (Green)
      ctx.fillStyle = "rgba(38, 166, 154, 0.2)";
      ctx.strokeStyle = "#26a69a";
      ctx.fillRect(left, Math.min(y0, yTarget), right - left, Math.abs(y0 - yTarget));
      ctx.strokeRect(left, Math.min(y0, yTarget), right - left, Math.abs(y0 - yTarget));

      // Loss area (Red)
      ctx.fillStyle = "rgba(239, 83, 80, 0.2)";
      ctx.strokeStyle = "#ef5350";
      ctx.fillRect(left, Math.min(y0, yStop), right - left, Math.abs(y0 - yStop));
      ctx.strokeRect(left, Math.min(y0, yStop), right - left, Math.abs(y0 - yStop));

      // Entry line
      ctx.strokeStyle = "#ffffff";
      line(ctx, left, y0, right, y0);

      // Labels
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Target: ${targetPrice.toFixed(2)} (+${(((targetPrice - entryPrice) / entryPrice) * 100).toFixed(2)}%)`, left + 6, Math.min(y0, yTarget) + 14);
      ctx.fillText(`Stop: ${stopPrice.toFixed(2)} (-${(((entryPrice - stopPrice) / entryPrice) * 100).toFixed(2)}%)`, left + 6, Math.max(y0, yStop) - 6);
      ctx.fillText(`Risk/Reward: 2.00 | Entry: ${entryPrice.toFixed(2)}`, left + 6, y0 - 4);
      break;
    }
    case "short-position": {
      const p0 = d.points[0]!;
      const p1 = d.points[1]!;
      const [x0, y0] = toXY(viewport, p0.index, p0.price);
      const [x1, y1] = toXY(viewport, p1.index, p1.price);
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1) + Math.max(60, Math.abs(x1 - x0));
      const entryPrice = p0.price;
      // Stop is above entry, target is below entry
      const stopPrice = Math.max(p0.price, p1.price);
      const targetPrice = entryPrice - Math.abs(stopPrice - entryPrice) * 2;
      const [, yStop] = toXY(viewport, p0.index, stopPrice);
      const [, yTarget] = toXY(viewport, p0.index, targetPrice);

      // Loss area (Red - top)
      ctx.fillStyle = "rgba(239, 83, 80, 0.2)";
      ctx.strokeStyle = "#ef5350";
      ctx.fillRect(left, Math.min(y0, yStop), right - left, Math.abs(y0 - yStop));
      ctx.strokeRect(left, Math.min(y0, yStop), right - left, Math.abs(y0 - yStop));

      // Profit area (Green - bottom)
      ctx.fillStyle = "rgba(38, 166, 154, 0.2)";
      ctx.strokeStyle = "#26a69a";
      ctx.fillRect(left, Math.min(y0, yTarget), right - left, Math.abs(y0 - yTarget));
      ctx.strokeRect(left, Math.min(y0, yTarget), right - left, Math.abs(y0 - yTarget));

      // Entry line
      ctx.strokeStyle = "#ffffff";
      line(ctx, left, y0, right, y0);

      // Labels
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Stop: ${stopPrice.toFixed(2)} (+${(((stopPrice - entryPrice) / entryPrice) * 100).toFixed(2)}%)`, left + 6, Math.min(y0, yStop) + 14);
      ctx.fillText(`Target: ${targetPrice.toFixed(2)} (-${(((entryPrice - targetPrice) / entryPrice) * 100).toFixed(2)}%)`, left + 6, Math.max(y0, yTarget) - 6);
      ctx.fillText(`Risk/Reward: 2.00 | Entry: ${entryPrice.toFixed(2)}`, left + 6, y0 + 12);
      break;
    }
    case "callout": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      line(ctx, x1, y1, x2, y2);
      ctx.fillStyle = "rgba(30, 34, 45, 0.9)";
      ctx.strokeStyle = d.color;
      const text = d.text ?? "Note";
      const metrics = ctx.measureText(text);
      const w = Math.max(60, metrics.width + 16);
      const h = 24;
      ctx.fillRect(x2, y2 - h / 2, w, h);
      ctx.strokeRect(x2, y2 - h / 2, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x2 + 8, y2 + 4);
      break;
    }
    case "price-label": {
      const [x, y] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const text = `${d.points[0]!.price.toFixed(2)}`;
      ctx.fillStyle = d.color || "#2962ff";
      const metrics = ctx.measureText(text);
      const w = metrics.width + 12;
      const h = 20;
      ctx.fillRect(x, y - h / 2, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x + 6, y + 4);
      break;
    }
    case "measure": {
      const [x1, y1] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      const [x2, y2] = toXY(viewport, d.points[1]!.index, d.points[1]!.price);
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      const diff = d.points[1]!.price - d.points[0]!.price;
      const pct = (diff / d.points[0]!.price) * 100;
      const bars = Math.abs(d.points[1]!.index - d.points[0]!.index);
      ctx.fillStyle = diff >= 0 ? "rgba(38, 166, 154, 0.15)" : "rgba(239, 83, 80, 0.15)";
      ctx.strokeStyle = diff >= 0 ? "#26a69a" : "#ef5350";
      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left, top, w, h);
      line(ctx, x1, y1, x2, y2);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} bars`, left + 6, top + 16);
      break;
    }
    case "icon": {
      const [x, y] = toXY(viewport, d.points[0]!.index, d.points[0]!.price);
      ctx.font = `18px ${theme.fontFamily}`;
      ctx.fillText(d.icon || "⭐", x - 9, y + 6);
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

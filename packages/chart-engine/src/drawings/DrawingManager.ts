import { Viewport } from "../viewport/Viewport";
import { DrawingObject, DrawingPoint, DrawingType } from "./types";

const HIT_TOLERANCE_PX = 6;

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

let idCounter = 0;
export function generateDrawingId(): string {
  idCounter += 1;
  return `drawing-${Date.now().toString(36)}-${idCounter}`;
}

/** Owns the set of persisted drawing objects for one chart pane and supports pixel-space hit-testing for editing. */
export class DrawingManager {
  private drawings = new Map<string, DrawingObject>();

  add(type: DrawingType, points: DrawingPoint[], color: string, lineWidth = 1.5, text?: string): DrawingObject {
    const obj: DrawingObject = { id: generateDrawingId(), type, points, color, lineWidth, text };
    this.drawings.set(obj.id, obj);
    return obj;
  }

  remove(id: string): void {
    this.drawings.delete(id);
  }

  update(id: string, patch: Partial<DrawingObject>): void {
    const existing = this.drawings.get(id);
    if (existing) this.drawings.set(id, { ...existing, ...patch });
  }

  list(): DrawingObject[] {
    return Array.from(this.drawings.values());
  }

  clear(): void {
    this.drawings.clear();
  }

  setAllLocked(locked: boolean): void {
    for (const [id, d] of this.drawings.entries()) {
      this.drawings.set(id, { ...d, locked });
    }
  }

  /** Finds the drawing nearest a pixel point, within tolerance, for selection/dragging. */
  findNearest(pixelX: number, pixelY: number, viewport: Viewport): string | null {
    let bestId: string | null = null;
    let bestDist = HIT_TOLERANCE_PX;

    for (const d of this.drawings.values()) {
      if (d.locked) continue;
      const px = d.points.map((pt) => [viewport.indexToX(pt.index) + viewport.getCandleWidth() / 2, viewport.priceToY(pt.price, "main")] as const);

      let dist = Infinity;
      if (px.length === 1) {
        dist = Math.hypot(pixelX - px[0]![0], pixelY - px[0]![1]);
      } else {
        for (let i = 0; i < px.length - 1; i++) {
          dist = Math.min(dist, distanceToSegment(pixelX, pixelY, px[i]![0], px[i]![1], px[i + 1]![0], px[i + 1]![1]));
        }
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestId = d.id;
      }
    }
    return bestId;
  }
}

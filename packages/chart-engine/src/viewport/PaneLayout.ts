export interface PaneSpec {
  id: string;
  weight: number;
  minHeight: number;
}

export interface PaneRect {
  id: string;
  top: number;
  height: number;
}

export const TIME_AXIS_HEIGHT = 28;
export const PRICE_AXIS_WIDTH = 68;

/**
 * Splits the plot area's vertical space across the main price pane, the
 * volume pane, and any separate-pane indicators (RSI/MACD/ATR/ADX/...),
 * proportional to each pane's weight and respecting a minimum height.
 */
export function computePaneLayout(totalHeight: number, specs: PaneSpec[]): PaneRect[] {
  if (specs.length === 0) return [];
  const minTotal = specs.reduce((s, p) => s + p.minHeight, 0);
  const available = Math.max(totalHeight, minTotal);
  const flexHeight = available - minTotal;
  const weightSum = specs.reduce((s, p) => s + p.weight, 0) || 1;

  let top = 0;
  const rects: PaneRect[] = [];
  for (const spec of specs) {
    const height = spec.minHeight + (flexHeight * spec.weight) / weightSum;
    rects.push({ id: spec.id, top, height });
    top += height;
  }
  return rects;
}

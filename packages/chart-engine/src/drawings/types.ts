export type DrawingType =
  | "horizontal-line"
  | "vertical-line"
  | "trend-line"
  | "ray"
  | "horizontal-ray"
  | "rectangle"
  | "circle"
  | "horizontal-channel"
  | "parallel-channel"
  | "fib-retracement"
  | "fib-extension"
  | "text"
  | "callout"
  | "price-label"
  | "arrow"
  | "brush"
  | "highlighter"
  | "long-position"
  | "short-position"
  | "measure"
  | "price-range"
  | "date-range"
  | "icon";

/** Anchored in data space (candle index + price) so drawings stay put across pan/zoom. */
export interface DrawingPoint {
  index: number;
  price: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  text?: string;
  icon?: string;
  /** Locked drawings are rendered but not hit-tested for editing. */
  locked?: boolean;
}

export const POINTS_REQUIRED: Record<DrawingType, number> = {
  "horizontal-line": 1,
  "vertical-line": 1,
  "trend-line": 2,
  ray: 2,
  "horizontal-ray": 2,
  rectangle: 2,
  circle: 2,
  "horizontal-channel": 3,
  "parallel-channel": 3,
  "fib-retracement": 2,
  "fib-extension": 3,
  text: 1,
  callout: 2,
  "price-label": 1,
  arrow: 2,
  brush: 2,
  highlighter: 2,
  "long-position": 2,
  "short-position": 2,
  measure: 2,
  "price-range": 2,
  "date-range": 2,
  icon: 1,
};

export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2.618];

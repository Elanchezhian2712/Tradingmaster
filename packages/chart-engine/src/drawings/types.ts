export type DrawingType =
  | "horizontal-line"
  | "vertical-line"
  | "trend-line"
  | "ray"
  | "rectangle"
  | "horizontal-channel"
  | "fib-retracement"
  | "fib-extension"
  | "text"
  | "arrow"
  | "price-range"
  | "date-range";

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
  /** Locked drawings are rendered but not hit-tested for editing. */
  locked?: boolean;
}

export const POINTS_REQUIRED: Record<DrawingType, number> = {
  "horizontal-line": 1,
  "vertical-line": 1,
  "trend-line": 2,
  ray: 2,
  rectangle: 2,
  "horizontal-channel": 3,
  "fib-retracement": 2,
  "fib-extension": 3,
  text: 1,
  arrow: 2,
  "price-range": 2,
  "date-range": 2,
};

export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2.618];

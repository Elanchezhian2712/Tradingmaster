import { IndicatorType } from "@trading-master/indicators";

export interface IndicatorCatalogEntry {
  type: IndicatorType;
  label: string;
  defaultParams: Record<string, number>;
  pane: "overlay" | "separate";
  lines: { key: string; color: string; style?: "line" | "histogram" }[];
  fixedRange?: { min: number; max: number };
}

export const INDICATOR_CATALOG: IndicatorCatalogEntry[] = [
  { type: "SMA", label: "SMA", defaultParams: { period: 20 }, pane: "overlay", lines: [{ key: "sma", color: "#42a5f5" }] },
  { type: "EMA", label: "EMA", defaultParams: { period: 21 }, pane: "overlay", lines: [{ key: "ema", color: "#ffb74d" }] },
  { type: "WMA", label: "WMA", defaultParams: { period: 20 }, pane: "overlay", lines: [{ key: "wma", color: "#ba68c8" }] },
  { type: "VWAP", label: "VWAP", defaultParams: {}, pane: "overlay", lines: [{ key: "vwap", color: "#26c6da" }] },
  {
    type: "BOLLINGER",
    label: "Bollinger Bands",
    defaultParams: { period: 20, stdDevMultiplier: 2 },
    pane: "overlay",
    lines: [
      { key: "upper", color: "rgba(120,144,156,0.9)" },
      { key: "middle", color: "rgba(120,144,156,0.5)" },
      { key: "lower", color: "rgba(120,144,156,0.9)" },
    ],
  },
  {
    type: "SUPERTREND",
    label: "Supertrend",
    defaultParams: { period: 10, multiplier: 3 },
    pane: "overlay",
    lines: [{ key: "value", color: "#66bb6a" }],
  },
  {
    type: "RSI",
    label: "RSI",
    defaultParams: { period: 14 },
    pane: "separate",
    lines: [{ key: "rsi", color: "#ab47bc" }],
    fixedRange: { min: 0, max: 100 },
  },
  {
    type: "MACD",
    label: "MACD",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    pane: "separate",
    lines: [
      { key: "macd", color: "#42a5f5" },
      { key: "signal", color: "#ff7043" },
      { key: "histogram", color: "rgba(120,144,156,0.6)", style: "histogram" },
    ],
  },
  { type: "ATR", label: "ATR", defaultParams: { period: 14 }, pane: "separate", lines: [{ key: "atr", color: "#8d6e63" }] },
  {
    type: "ADX",
    label: "ADX",
    defaultParams: { period: 14 },
    pane: "separate",
    lines: [
      { key: "adx", color: "#eeff41" },
      { key: "plusDI", color: "#26a69a" },
      { key: "minusDI", color: "#ef5350" },
    ],
    fixedRange: { min: 0, max: 100 },
  },
  {
    type: "VOLUME_AVERAGE",
    label: "Volume Average",
    defaultParams: { period: 20 },
    pane: "separate",
    lines: [{ key: "average", color: "#90a4ae" }],
  },
  {
    type: "VOLUME_SPIKE",
    label: "Volume Spike",
    defaultParams: { period: 20, multiplier: 2 },
    pane: "separate",
    lines: [{ key: "ratio", color: "#ffca28" }],
  },
];

export function catalogEntry(type: IndicatorType): IndicatorCatalogEntry {
  const entry = INDICATOR_CATALOG.find((e) => e.type === type);
  if (!entry) throw new Error(`Unknown indicator type: ${type}`);
  return entry;
}

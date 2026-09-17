export interface ChartTheme {
  background: string;
  gridColor: string;
  textColor: string;
  axisBorderColor: string;
  upColor: [number, number, number];
  downColor: [number, number, number];
  wickUpColor: [number, number, number];
  wickDownColor: [number, number, number];
  volumeUpColor: string;
  volumeDownColor: string;
  crosshairColor: string;
  crosshairLabelBg: string;
  crosshairLabelText: string;
  tooltipBg: string;
  tooltipText: string;
  fontFamily: string;
}

function hexToRgb01(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export const darkTheme: ChartTheme = {
  background: "#0e1117",
  gridColor: "rgba(255,255,255,0.06)",
  textColor: "#c9d1d9",
  axisBorderColor: "rgba(255,255,255,0.12)",
  upColor: hexToRgb01("#26a69a"),
  downColor: hexToRgb01("#ef5350"),
  wickUpColor: hexToRgb01("#26a69a"),
  wickDownColor: hexToRgb01("#ef5350"),
  volumeUpColor: "rgba(38,166,154,0.5)",
  volumeDownColor: "rgba(239,83,80,0.5)",
  crosshairColor: "rgba(255,255,255,0.35)",
  crosshairLabelBg: "#2a2e39",
  crosshairLabelText: "#e6e6e6",
  tooltipBg: "rgba(22,26,34,0.95)",
  tooltipText: "#e6e6e6",
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

export const lightTheme: ChartTheme = {
  background: "#ffffff",
  gridColor: "rgba(0,0,0,0.06)",
  textColor: "#333333",
  axisBorderColor: "rgba(0,0,0,0.12)",
  upColor: hexToRgb01("#26a69a"),
  downColor: hexToRgb01("#ef5350"),
  wickUpColor: hexToRgb01("#26a69a"),
  wickDownColor: hexToRgb01("#ef5350"),
  volumeUpColor: "rgba(38,166,154,0.4)",
  volumeDownColor: "rgba(239,83,80,0.4)",
  crosshairColor: "rgba(0,0,0,0.35)",
  crosshairLabelBg: "#eef0f3",
  crosshairLabelText: "#222222",
  tooltipBg: "rgba(255,255,255,0.97)",
  tooltipText: "#222222",
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

export type ThemeName = "dark" | "light";

export function resolveTheme(name: ThemeName): ChartTheme {
  return name === "dark" ? darkTheme : lightTheme;
}

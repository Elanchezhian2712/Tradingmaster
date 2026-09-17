import { Timeframe } from "@trading-master/market-data";
import { DrawingType } from "@trading-master/chart-engine";
import { ScaleMode, ThemeName } from "@trading-master/chart-engine";

const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];

const DRAWING_TOOLS: { type: DrawingType; label: string }[] = [
  { type: "trend-line", label: "Trend Line" },
  { type: "ray", label: "Ray" },
  { type: "horizontal-line", label: "H-Line" },
  { type: "vertical-line", label: "V-Line" },
  { type: "rectangle", label: "Rectangle" },
  { type: "horizontal-channel", label: "Channel" },
  { type: "fib-retracement", label: "Fib Retr." },
  { type: "fib-extension", label: "Fib Ext." },
  { type: "arrow", label: "Arrow" },
  { type: "text", label: "Text" },
  { type: "price-range", label: "Price Range" },
  { type: "date-range", label: "Date Range" },
];

export interface ToolbarProps {
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  themeName: ThemeName;
  onThemeToggle: () => void;
  scaleMode: ScaleMode;
  onScaleModeChange: (mode: ScaleMode) => void;
  autoScale: boolean;
  onAutoScaleToggle: () => void;
  onReset: () => void;
  onFitAll: () => void;
  activeDrawingTool: DrawingType | null;
  onSelectDrawingTool: (type: DrawingType | null) => void;
  onClearDrawings: () => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="symbol-badge">{props.symbol}</span>
        {TIMEFRAMES.map((tf) => (
          <button key={tf} className={tf === props.timeframe ? "tf-btn active" : "tf-btn"} onClick={() => props.onTimeframeChange(tf)}>
            {tf}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        {DRAWING_TOOLS.map((tool) => (
          <button
            key={tool.type}
            className={tool.type === props.activeDrawingTool ? "icon-btn active" : "icon-btn"}
            title={tool.label}
            onClick={() => props.onSelectDrawingTool(tool.type === props.activeDrawingTool ? null : tool.type)}
          >
            {tool.label}
          </button>
        ))}
        <button className="icon-btn" title="Clear drawings" onClick={props.onClearDrawings}>
          Clear
        </button>
      </div>

      <div className="toolbar-group">
        <select value={props.scaleMode} onChange={(e) => props.onScaleModeChange(e.target.value as ScaleMode)}>
          <option value="linear">Linear</option>
          <option value="log">Log</option>
          <option value="percentage">Percent</option>
        </select>
        <button className={props.autoScale ? "icon-btn active" : "icon-btn"} onClick={props.onAutoScaleToggle}>
          Auto
        </button>
        <button className="icon-btn" onClick={props.onFitAll} title="Fit all (F)">
          Fit
        </button>
        <button className="icon-btn" onClick={props.onReset} title="Reset (R)">
          Reset
        </button>
        <button className="icon-btn" onClick={props.onThemeToggle}>
          {props.themeName === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </div>
  );
}

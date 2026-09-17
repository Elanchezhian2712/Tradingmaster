import { useState } from "react";

export interface PineEditorProps {
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export function PineEditor(props: PineEditorProps = {}) {
  const defaultScript = `//@version=5
indicator("TradingMaster Custom Trend", overlay=true)

// Exponential Moving Averages
emaFast = ta.ema(close, 9)
emaSlow = ta.ema(close, 21)

// Plot signals
plot(emaFast, color=color.blue, title="EMA 9")
plot(emaSlow, color=color.orange, title="EMA 21")

buySignal = ta.crossover(emaFast, emaSlow)
sellSignal = ta.crossunder(emaFast, emaSlow)

plotshape(buySignal, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small)
plotshape(sellSignal, style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small)
`;

  const [script, setScript] = useState(defaultScript);
  const [status, setStatus] = useState<string | null>(null);

  function handleSave() {
    setStatus("Compiling and adding to chart... Success!");
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div className={`tv-dock-panel pine-editor-panel ${props.collapsed ? "collapsed" : ""}`}>
      <div className="tv-dock-header">
        <div className="tv-dock-title">
          <span>Pine Editor v5</span>
          {status && <span className="tv-compile-success">{status}</span>}
        </div>
        <div className="tv-dock-actions">
          <button className="tv-btn-small" onClick={() => setScript(defaultScript)}>Reset</button>
          <button className="tv-btn-primary tv-btn-small" onClick={handleSave}>Add to Chart</button>
          {props.onToggleMaximize && (
            <button className="tv-dock-icon-btn" onClick={props.onToggleMaximize} title={props.maximized ? "Restore Height" : "Maximize Panel"}>
              {props.maximized ? "🗗" : "🗖"}
            </button>
          )}
          {props.onToggleCollapse && (
            <button className="tv-dock-icon-btn tv-dock-toggle-btn" onClick={() => props.onToggleCollapse?.(!props.collapsed)} title={props.collapsed ? "Expand Panel (▲)" : "Collapse Panel (▼)"}>
              {props.collapsed ? "▲" : "▼"}
            </button>
          )}
          {props.onClose && (
            <button className="tv-dock-icon-btn tv-dock-close-btn" onClick={props.onClose} title="Close Panel">
              ✕
            </button>
          )}
        </div>
      </div>
      {!props.collapsed && (
        <textarea
          className="tv-pine-textarea"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
}

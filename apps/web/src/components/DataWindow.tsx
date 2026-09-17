import { CandleSnapshot } from "@trading-master/market-data";
import { ActiveIndicator } from "../types";

export interface DataWindowProps {
  symbol: string;
  bar: CandleSnapshot | null;
  indicators: ActiveIndicator[];
}

export function DataWindow(props: DataWindowProps) {
  const bar = props.bar;

  return (
    <div className="tv-panel-content data-window-panel">
      <div className="tv-panel-header">
        <h4>Data Window</h4>
      </div>

      <div className="tv-data-section">
        <div className="tv-data-symbol-title">{props.symbol}</div>
        <div className="tv-data-row">
          <span>Date/Time</span>
          <b>{bar ? new Date(bar.time * 1000).toLocaleString() : "-"}</b>
        </div>
        <div className="tv-data-row">
          <span>Open</span>
          <b>{bar ? bar.open.toFixed(2) : "-"}</b>
        </div>
        <div className="tv-data-row">
          <span>High</span>
          <b>{bar ? bar.high.toFixed(2) : "-"}</b>
        </div>
        <div className="tv-data-row">
          <span>Low</span>
          <b>{bar ? bar.low.toFixed(2) : "-"}</b>
        </div>
        <div className="tv-data-row">
          <span>Close</span>
          <b>{bar ? bar.close.toFixed(2) : "-"}</b>
        </div>
        <div className="tv-data-row">
          <span>Volume</span>
          <b>{bar ? Math.round(bar.volume).toLocaleString() : "-"}</b>
        </div>
      </div>

      <div className="tv-data-section">
        <div className="tv-data-subtitle">Indicators & Studies</div>
        {props.indicators.length === 0 ? (
          <div className="tv-empty-hint">No active indicators on chart</div>
        ) : (
          props.indicators.map((ind) => (
            <div key={ind.id} className="tv-data-row">
              <span>{ind.label}</span>
              <span className="tv-ind-status">{ind.enabled ? "Active" : "Hidden"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

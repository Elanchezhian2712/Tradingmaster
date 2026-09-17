import { useState, useEffect } from "react";
import { ScaleMode } from "@trading-master/chart-engine";

export type BottomDockTab = "trading" | "pine" | "strategy" | "screener" | null;

export interface BottomBarProps {
  scaleMode: ScaleMode;
  onScaleModeChange: (mode: ScaleMode) => void;
  autoScale: boolean;
  onToggleAutoScale: () => void;
  onFitAll: () => void;
  onReset: () => void;
  activeDockTab: BottomDockTab;
  onSelectDockTab: (tab: BottomDockTab) => void;
  onSelectRange: (range: string) => void;
}

export function BottomBar(props: BottomBarProps) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      const secs = String(now.getSeconds()).padStart(2, "0");
      setTimeStr(`${hours}:${mins}:${secs} (UTC+5:30)`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const ranges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

  return (
    <footer className="tv-bottombar">
      {/* Left side: Date Range Quick Buttons */}
      <div className="tv-bottom-ranges">
        {ranges.map((r) => (
          <button key={r} className="tv-range-btn" onClick={() => props.onSelectRange(r)}>
            {r}
          </button>
        ))}
        <button className="tv-range-btn" onClick={props.onFitAll} title="Fit Entire Dataset (F)">
          Fit
        </button>
        <button className="tv-range-btn" onClick={props.onReset} title="Reset View (R)">
          Reset
        </button>
      </div>

      {/* Center: Bottom Dock Tabs (Trading Panel, Pine Editor, etc.) */}
      <div className="tv-bottom-tabs">
        <button
          className={`tv-dock-tab-btn ${props.activeDockTab === "trading" ? "active" : ""}`}
          onClick={() => props.onSelectDockTab(props.activeDockTab === "trading" ? null : "trading")}
        >
          Trading Panel
        </button>
        <button
          className={`tv-dock-tab-btn ${props.activeDockTab === "pine" ? "active" : ""}`}
          onClick={() => props.onSelectDockTab(props.activeDockTab === "pine" ? null : "pine")}
        >
          Pine Editor
        </button>
        <button
          className={`tv-dock-tab-btn ${props.activeDockTab === "strategy" ? "active" : ""}`}
          onClick={() => props.onSelectDockTab(props.activeDockTab === "strategy" ? null : "strategy")}
        >
          Strategy Tester
        </button>
        <button
          className={`tv-dock-tab-btn ${props.activeDockTab === "screener" ? "active" : ""}`}
          onClick={() => props.onSelectDockTab(props.activeDockTab === "screener" ? null : "screener")}
        >
          Stock Screener
        </button>
      </div>

      {/* Right side: Real-time Clock, Timezone & Scale Controls */}
      <div className="tv-bottom-scales">
        <div className="tv-clock-badge">{timeStr}</div>

        <button
          className={`tv-scale-btn ${props.scaleMode === "percentage" ? "active" : ""}`}
          onClick={() => props.onScaleModeChange(props.scaleMode === "percentage" ? "linear" : "percentage")}
          title="Percentage Scale (%)"
        >
          %
        </button>

        <button
          className={`tv-scale-btn ${props.scaleMode === "log" ? "active" : ""}`}
          onClick={() => props.onScaleModeChange(props.scaleMode === "log" ? "linear" : "log")}
          title="Logarithmic Scale (log)"
        >
          log
        </button>

        <button
          className={`tv-scale-btn ${props.autoScale ? "active" : ""}`}
          onClick={props.onToggleAutoScale}
          title="Auto Scale (A)"
        >
          auto
        </button>
      </div>
    </footer>
  );
}

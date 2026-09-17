import { useState } from "react";
import { Timeframe } from "@trading-master/market-data";
import { ThemeName } from "@trading-master/chart-engine";
import {
  IconCandlestick,
  IconIndicators,
  IconAlert,
  IconReplay,
  IconUndo,
  IconRedo,
  IconSettings,
  IconFullscreen,
  IconCamera,
  IconChevronDown,
  IconPlus,
} from "./icons";

const QUICK_TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1H", "4H", "1D", "1W", "1M"];

export type ChartType = "candles" | "hollow" | "heikin-ashi" | "line" | "area" | "bars";

export interface TopBarProps {
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  themeName: ThemeName;
  onThemeToggle: () => void;
  onOpenSymbolSearch: () => void;
  onOpenIndicators: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onTakeSnapshot: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  replayActive: boolean;
  onToggleReplay: () => void;
}

export function TopBar(props: TopBarProps) {
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <header className="tv-topbar">
      {/* Left side: Avatar, Symbol Search, Compare */}
      <div className="tv-topbar-section">
        <div className="tv-avatar-btn" title="User Profile (Elanchezhian)">
          <span>E</span>
        </div>

        <div className="tv-topbar-divider" />

        <button className="tv-symbol-btn" onClick={props.onOpenSymbolSearch} title="Search Symbol (Alt+S)">
          <span className="tv-symbol-name">{props.symbol}</span>
          <span className="tv-symbol-market">NSE</span>
          <IconChevronDown />
        </button>

        <button className="tv-icon-btn" onClick={props.onOpenSymbolSearch} title="Compare or Add Symbol">
          <IconPlus />
        </button>

        <div className="tv-topbar-divider" />

        {/* Timeframes */}
        <div className="tv-tf-list">
          {QUICK_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`tv-tf-btn ${tf === props.timeframe ? "active" : ""}`}
              onClick={() => props.onTimeframeChange(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="tv-topbar-divider" />

        {/* Chart Style Dropdown */}
        <div className="tv-dropdown-container">
          <button
            className={`tv-icon-btn with-chevron ${showChartTypeDropdown ? "active" : ""}`}
            onClick={() => setShowChartTypeDropdown(!showChartTypeDropdown)}
            title="Chart Style"
          >
            <IconCandlestick />
            <IconChevronDown />
          </button>
          {showChartTypeDropdown && (
            <div className="tv-menu-dropdown" onMouseLeave={() => setShowChartTypeDropdown(false)}>
              <div className={`tv-menu-item ${props.chartType === "candles" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("candles"); setShowChartTypeDropdown(false); }}>
                <span>Candles</span>
              </div>
              <div className={`tv-menu-item ${props.chartType === "hollow" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("hollow"); setShowChartTypeDropdown(false); }}>
                <span>Hollow Candles</span>
              </div>
              <div className={`tv-menu-item ${props.chartType === "heikin-ashi" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("heikin-ashi"); setShowChartTypeDropdown(false); }}>
                <span>Heikin Ashi</span>
              </div>
              <div className={`tv-menu-item ${props.chartType === "line" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("line"); setShowChartTypeDropdown(false); }}>
                <span>Line</span>
              </div>
              <div className={`tv-menu-item ${props.chartType === "area" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("area"); setShowChartTypeDropdown(false); }}>
                <span>Area</span>
              </div>
              <div className={`tv-menu-item ${props.chartType === "bars" ? "active" : ""}`} onClick={() => { props.onChartTypeChange("bars"); setShowChartTypeDropdown(false); }}>
                <span>Bars</span>
              </div>
            </div>
          )}
        </div>

        <div className="tv-topbar-divider" />

        {/* Indicators Button */}
        <button className="tv-pill-btn" onClick={props.onOpenIndicators} title="Technical Indicators (/)">
          <IconIndicators />
          <span>Indicators</span>
        </button>

        {/* Indicator Templates Button */}
        <div className="tv-dropdown-container">
          <button
            className="tv-icon-btn"
            onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
            title="Indicator Templates"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="6" height="6" rx="1" />
              <rect x="10" y="2" width="6" height="6" rx="1" />
              <rect x="2" y="10" width="6" height="6" rx="1" />
              <rect x="10" y="10" width="6" height="6" rx="1" />
            </svg>
          </button>
          {showTemplateDropdown && (
            <div className="tv-menu-dropdown" onMouseLeave={() => setShowTemplateDropdown(false)}>
              <div className="tv-menu-header">Indicator Templates</div>
              <div className="tv-menu-item" onClick={() => setShowTemplateDropdown(false)}>Default Setup (Vol + EMA)</div>
              <div className="tv-menu-item" onClick={() => setShowTemplateDropdown(false)}>Trend Following (EMA 20/50/200 + Supertrend)</div>
              <div className="tv-menu-item" onClick={() => setShowTemplateDropdown(false)}>Momentum Scalping (RSI + MACD + VWAP)</div>
              <div className="tv-menu-item" onClick={() => setShowTemplateDropdown(false)}>Volatility Breakout (Bollinger Bands + ATR)</div>
            </div>
          )}
        </div>

        {/* Alert Button */}
        <button className="tv-pill-btn" onClick={props.onOpenAlerts} title="Create Price Alert (Alt+A)">
          <IconAlert />
          <span>Alert</span>
        </button>

        {/* Replay Button */}
        <button
          className={`tv-pill-btn ${props.replayActive ? "active-accent" : ""}`}
          onClick={props.onToggleReplay}
          title="Bar Replay Mode"
        >
          <IconReplay />
          <span>Replay</span>
        </button>

        <div className="tv-topbar-divider" />

        {/* Undo / Redo */}
        <button className="tv-icon-btn" onClick={props.onUndo} title="Undo (Ctrl+Z)">
          <IconUndo />
        </button>
        <button className="tv-icon-btn" onClick={props.onRedo} title="Redo (Ctrl+Y)">
          <IconRedo />
        </button>
      </div>

      {/* Right side: Save, Settings, Fullscreen, Snapshot, Theme */}
      <div className="tv-topbar-section right">
        <div className="tv-save-badge" title="Auto-saved to Cloud">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#26a69a" strokeWidth="1.5">
            <path d="M4 12H12C13.66 12 15 10.66 15 9C15 7.42 13.78 6.13 12.23 6.01C11.75 3.72 9.72 2 7.3 2C4.54 2 2.3 4.24 2.3 7C1 7.5 0 8.64 0 10C0 11.66 1.34 13 3 13H4" />
          </svg>
          <span>Save</span>
        </div>

        <button className="tv-icon-btn" onClick={props.onOpenSettings} title="Chart Settings">
          <IconSettings />
        </button>

        <button className="tv-icon-btn" onClick={toggleFullscreen} title="Fullscreen (F11)">
          <IconFullscreen />
        </button>

        <button className="tv-icon-btn" onClick={props.onTakeSnapshot} title="Take a snapshot">
          <IconCamera />
        </button>

        <button className="tv-icon-btn" onClick={props.onThemeToggle} title={`Switch to ${props.themeName === "dark" ? "Light" : "Dark"} Mode`}>
          {props.themeName === "dark" ? "☀️" : "🌙"}
        </button>

        <button className="tv-publish-btn" onClick={props.onTakeSnapshot} title="Share chart snapshot">
          Publish
        </button>
      </div>
    </header>
  );
}

import { useState } from "react";
import { ScaleMode } from "@trading-master/chart-engine";

export interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scaleMode: ScaleMode;
  onScaleModeChange: (mode: ScaleMode) => void;
  autoScale: boolean;
  onToggleAutoScale: () => void;
}

export function ChartSettingsModal(props: ChartSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"symbol" | "status" | "scales" | "appearance">("symbol");
  const [candleUpColor, setCandleUpColor] = useState("#26a69a");
  const [candleDownColor, setCandleDownColor] = useState("#ef5350");
  const [showGrid, setShowGrid] = useState(true);

  if (!props.isOpen) return null;

  return (
    <div className="tv-modal-backdrop" onClick={props.onClose}>
      <div className="tv-modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-header">
          <h3>Chart Settings</h3>
          <button className="tv-modal-close-btn" onClick={props.onClose}>✕</button>
        </div>

        <div className="tv-settings-layout">
          <div className="tv-settings-tabs">
            <button className={`tv-set-tab ${activeTab === "symbol" ? "active" : ""}`} onClick={() => setActiveTab("symbol")}>
              Symbol
            </button>
            <button className={`tv-set-tab ${activeTab === "status" ? "active" : ""}`} onClick={() => setActiveTab("status")}>
              Status Line
            </button>
            <button className={`tv-set-tab ${activeTab === "scales" ? "active" : ""}`} onClick={() => setActiveTab("scales")}>
              Scales
            </button>
            <button className={`tv-set-tab ${activeTab === "appearance" ? "active" : ""}`} onClick={() => setActiveTab("appearance")}>
              Appearance
            </button>
          </div>

          <div className="tv-settings-panel">
            {activeTab === "symbol" && (
              <div className="tv-settings-group">
                <h4>Candlestick Colors</h4>
                <div className="tv-color-row">
                  <label>Bullish (Body & Wick)</label>
                  <input type="color" value={candleUpColor} onChange={(e) => setCandleUpColor(e.target.value)} />
                </div>
                <div className="tv-color-row">
                  <label>Bearish (Body & Wick)</label>
                  <input type="color" value={candleDownColor} onChange={(e) => setCandleDownColor(e.target.value)} />
                </div>
                <div className="tv-checkbox-row">
                  <input type="checkbox" id="showWicks" defaultChecked />
                  <label htmlFor="showWicks">High / Low Wicks</label>
                </div>
              </div>
            )}

            {activeTab === "status" && (
              <div className="tv-settings-group">
                <h4>Status Line</h4>
                <div className="tv-checkbox-row">
                  <input type="checkbox" id="showOhlc" defaultChecked />
                  <label htmlFor="showOhlc">Show OHLC Values</label>
                </div>
                <div className="tv-checkbox-row">
                  <input type="checkbox" id="showChange" defaultChecked />
                  <label htmlFor="showChange">Show Bar Change Values (%)</label>
                </div>
                <div className="tv-checkbox-row">
                  <input type="checkbox" id="showVol" defaultChecked />
                  <label htmlFor="showVol">Show Volume & Indicator Values</label>
                </div>
              </div>
            )}

            {activeTab === "scales" && (
              <div className="tv-settings-group">
                <h4>Price Scale Mode</h4>
                <div className="tv-radio-group">
                  <label>
                    <input
                      type="radio"
                      name="scaleMode"
                      checked={props.scaleMode === "linear"}
                      onChange={() => props.onScaleModeChange("linear")}
                    />
                    Linear Scale (Regular)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="scaleMode"
                      checked={props.scaleMode === "log"}
                      onChange={() => props.onScaleModeChange("log")}
                    />
                    Logarithmic Scale (log)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="scaleMode"
                      checked={props.scaleMode === "percentage"}
                      onChange={() => props.onScaleModeChange("percentage")}
                    />
                    Percentage Scale (%)
                  </label>
                </div>
                <div className="tv-checkbox-row" style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="autoScale"
                    checked={props.autoScale}
                    onChange={props.onToggleAutoScale}
                  />
                  <label htmlFor="autoScale">Auto Fit Data Range</label>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="tv-settings-group">
                <h4>Grid & Layout</h4>
                <div className="tv-checkbox-row">
                  <input
                    type="checkbox"
                    id="gridToggle"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  <label htmlFor="gridToggle">Show Background Grid Lines</label>
                </div>
                <div className="tv-checkbox-row">
                  <input type="checkbox" id="watermarkToggle" defaultChecked />
                  <label htmlFor="watermarkToggle">Symbol Watermark</label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="tv-modal-actions">
          <button className="tv-btn-primary" onClick={props.onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { IndicatorType } from "@trading-master/indicators";
import { INDICATOR_CATALOG } from "../indicatorCatalog";
import { ActiveIndicator } from "../types";

export interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (type: IndicatorType) => void;
  onRemoveIndicator: (id: string) => void;
}

export function IndicatorsModal(props: IndicatorsModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "technicals" | "oscillators" | "volume">("all");

  if (!props.isOpen) return null;

  const filtered = INDICATOR_CATALOG.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(search.toLowerCase()) || item.type.toLowerCase().includes(search.toLowerCase());
    let matchesCat = true;
    if (selectedCategory === "oscillators") {
      matchesCat = ["RSI", "MACD", "ADX"].includes(item.type);
    } else if (selectedCategory === "volume") {
      matchesCat = ["VWAP", "VOLUME_AVERAGE", "VOLUME_SPIKE"].includes(item.type);
    } else if (selectedCategory === "technicals") {
      matchesCat = ["SMA", "EMA", "WMA", "BOLLINGER", "SUPERTREND", "ATR"].includes(item.type);
    }
    return matchesSearch && matchesCat;
  });

  return (
    <div className="tv-modal-backdrop" onClick={props.onClose}>
      <div className="tv-modal-content indicators-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-header">
          <div className="tv-search-input-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5" />
              <line x1="12" y1="12" x2="16" y2="16" />
            </svg>
            <input
              type="text"
              className="tv-search-input"
              placeholder="Search indicators, metrics & strategies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="tv-modal-close-btn" onClick={props.onClose}>✕</button>
        </div>

        <div className="tv-indicators-body">
          {/* Categories sidebar */}
          <div className="tv-ind-categories">
            <button className={`tv-ind-cat-btn ${selectedCategory === "all" ? "active" : ""}`} onClick={() => setSelectedCategory("all")}>
              All Indicators
            </button>
            <button className={`tv-ind-cat-btn ${selectedCategory === "technicals" ? "active" : ""}`} onClick={() => setSelectedCategory("technicals")}>
              Technicals & Overlays
            </button>
            <button className={`tv-ind-cat-btn ${selectedCategory === "oscillators" ? "active" : ""}`} onClick={() => setSelectedCategory("oscillators")}>
              Oscillators
            </button>
            <button className={`tv-ind-cat-btn ${selectedCategory === "volume" ? "active" : ""}`} onClick={() => setSelectedCategory("volume")}>
              Volume & Volatility
            </button>
          </div>

          {/* Indicators List */}
          <div className="tv-ind-list">
            {filtered.map((item) => {
              const active = props.activeIndicators.find((a) => a.type === item.type);
              return (
                <div key={item.type} className="tv-ind-row">
                  <div className="tv-ind-info">
                    <span className="tv-ind-title">{item.label}</span>
                    <span className="tv-ind-pane-tag">{item.pane === "overlay" ? "Main Chart" : "Separate Pane"}</span>
                  </div>
                  <button
                    className={`tv-ind-add-btn ${active ? "active" : ""}`}
                    onClick={() => {
                      if (active) {
                        props.onRemoveIndicator(active.id);
                      } else {
                        props.onAddIndicator(item.type);
                      }
                    }}
                  >
                    {active ? "Remove" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

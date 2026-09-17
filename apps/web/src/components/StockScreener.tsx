import { useState } from "react";

export interface StockScreenerProps {
  onSelectSymbol: (symbol: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export function StockScreener({
  onSelectSymbol,
  collapsed,
  onToggleCollapse,
  maximized,
  onToggleMaximize,
  onClose,
}: StockScreenerProps) {
  const stocks = [
    { symbol: "RELIANCE", ltp: 2942.50, change: "+1.85%", rsi: 62.4, vol: "4.2M", rating: "Strong Buy" },
    { symbol: "TCS", ltp: 4210.00, change: "+0.45%", rsi: 54.1, vol: "1.8M", rating: "Buy" },
    { symbol: "INFY", ltp: 1785.20, change: "-0.75%", rsi: 43.8, vol: "3.5M", rating: "Hold" },
    { symbol: "HDFCBANK", ltp: 1650.00, change: "+1.20%", rsi: 58.9, vol: "8.1M", rating: "Buy" },
    { symbol: "ICICIBANK", ltp: 1195.40, change: "+2.10%", rsi: 67.2, vol: "6.4M", rating: "Strong Buy" },
    { symbol: "SBIN", ltp: 840.15, change: "+0.80%", rsi: 52.3, vol: "9.2M", rating: "Buy" },
    { symbol: "TATAMOTORS", ltp: 980.50, change: "+3.25%", rsi: 71.0, vol: "7.5M", rating: "Strong Buy" },
  ];

  return (
    <div className={`tv-dock-panel screener-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="tv-dock-header">
        <div className="tv-dock-title">
          <span>NSE Stock Screener (Top Momentum)</span>
        </div>
        <div className="tv-dock-actions">
          {onToggleMaximize && (
            <button className="tv-dock-icon-btn" onClick={onToggleMaximize} title={maximized ? "Restore Height" : "Maximize Panel"}>
              {maximized ? "🗗" : "🗖"}
            </button>
          )}
          {onToggleCollapse && (
            <button className="tv-dock-icon-btn tv-dock-toggle-btn" onClick={() => onToggleCollapse?.(!collapsed)} title={collapsed ? "Expand Panel (▲)" : "Collapse Panel (▼)"}>
              {collapsed ? "▲" : "▼"}
            </button>
          )}
          {onClose && (
            <button className="tv-dock-icon-btn tv-dock-close-btn" onClick={onClose} title="Close Panel">
              ✕
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
      <table className="tv-screener-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>LTP (₹)</th>
            <th>Change %</th>
            <th>RSI (14)</th>
            <th>Volume</th>
            <th>Technical Rating</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.symbol} onClick={() => onSelectSymbol(s.symbol)} className="tv-screener-row">
              <td><b>{s.symbol}</b></td>
              <td>{s.ltp.toFixed(2)}</td>
              <td className={s.change.startsWith("+") ? "up" : "down"}>{s.change}</td>
              <td>{s.rsi}</td>
              <td>{s.vol}</td>
              <td>
                <span className={`tv-rating-badge ${s.rating.toLowerCase().replace(" ", "-")}`}>
                  {s.rating}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}

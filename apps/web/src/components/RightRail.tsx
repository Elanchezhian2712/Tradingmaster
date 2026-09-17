import React from "react";

export type RightRailTab = "watchlist" | "alerts" | "news" | "datawindow" | "hotlist" | "orders" | "objecttree" | null;

export interface RightRailProps {
  activeTab: RightRailTab;
  onSelectTab: (tab: RightRailTab) => void;
}

export function RightRail(props: RightRailProps) {
  function handleTabClick(tab: RightRailTab) {
    props.onSelectTab(props.activeTab === tab ? null : tab);
  }

  return (
    <aside className="tv-right-rail">
      <button
        className={`tv-rail-btn ${props.activeTab === "watchlist" ? "active" : ""}`}
        title="Watchlist and Details (Alt+W)"
        onClick={() => handleTabClick("watchlist")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <line x1="3" y1="7" x2="17" y2="7" />
          <line x1="7" y1="7" x2="7" y2="17" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "alerts" ? "active" : ""}`}
        title="Alerts Manager"
        onClick={() => handleTabClick("alerts")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7" />
          <line x1="10" y1="6" x2="10" y2="10" />
          <line x1="10" y1="10" x2="13" y2="12" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "news" ? "active" : ""}`}
        title="News & Market Headlines"
        onClick={() => handleTabClick("news")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="14" height="12" rx="1.5" />
          <line x1="6" y1="8" x2="14" y2="8" />
          <line x1="6" y1="11" x2="11" y2="11" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "datawindow" ? "active" : ""}`}
        title="Data Window (OHLC & Indicator Inspector)"
        onClick={() => handleTabClick("datawindow")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7" />
          <line x1="10" y1="9" x2="10" y2="14" />
          <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "hotlist" ? "active" : ""}`}
        title="Hotlists (Top Gainers & Losers)"
        onClick={() => handleTabClick("hotlist")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 2C10 2 12 5 12 7C12 8 13 9 14 9C15 9 16 11 16 13C16 16.31 13.31 19 10 19C6.69 19 4 16.31 4 13C4 10 6 7 7 6C8 5 8 4 10 2Z" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "orders" ? "active" : ""}`}
        title="Paper Trading Order Ticket & DOM"
        onClick={() => handleTabClick("orders")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="6" width="14" height="11" rx="2" />
          <path d="M7 6V4C7 2.9 7.9 2 9 2H11C12.1 2 13 2.9 13 4V6" />
          <line x1="3" y1="11" x2="17" y2="11" />
        </svg>
      </button>

      <button
        className={`tv-rail-btn ${props.activeTab === "objecttree" ? "active" : ""}`}
        title="Object Tree & Drawings Layer Manager"
        onClick={() => handleTabClick("objecttree")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="3" width="5" height="4" rx="1" />
          <rect x="11" y="9" width="5" height="4" rx="1" />
          <rect x="11" y="14" width="5" height="4" rx="1" />
          <path d="M6.5 7V16H11" />
          <path d="M6.5 11H11" />
        </svg>
      </button>
    </aside>
  );
}

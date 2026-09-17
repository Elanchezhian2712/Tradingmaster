import { useState } from "react";
import { WatchlistDef, WatchlistQuoteRow } from "../types";
import { IconPlus, IconChevronDown, IconChevronRight } from "./icons";

export interface WatchlistProps {
  lists: WatchlistDef[];
  activeListId: string;
  onSelectList: (id: string) => void;
  quotes: Map<string, WatchlistQuoteRow>;
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
  onAddSymbol: (listId: string, symbol: string) => void;
  onRemoveSymbol: (listId: string, symbol: string) => void;
  onReorder: (listId: string, symbol: string, direction: -1 | 1) => void;
  compact?: boolean;
}

interface SymbolGroup {
  id: string;
  title: string;
  symbols: string[];
}

export function Watchlist(props: WatchlistProps) {
  const [search, setSearch] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showDetailsPane, setShowDetailsPane] = useState(true);

  const activeList = props.lists.find((l) => l.id === props.activeListId) ?? props.lists[0]!;

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      props.onAddSymbol(activeList.id, search.trim().toUpperCase());
      setSearch("");
      setShowAddInput(false);
    }
  }

  // Categorize symbols into sections (Indices, Stocks, Crypto/Global) matching TradingView
  const indexSymbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "NIFTY500"];
  const cryptoSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT"];

  const groups: SymbolGroup[] = [
    {
      id: "indices",
      title: "INDICES",
      symbols: activeList.symbols.filter((s) => indexSymbols.includes(s)),
    },
    {
      id: "stocks",
      title: "STOCKS",
      symbols: activeList.symbols.filter((s) => !indexSymbols.includes(s) && !cryptoSymbols.includes(s)),
    },
    {
      id: "crypto",
      title: "CRYPTO & GLOBAL",
      symbols: activeList.symbols.filter((s) => cryptoSymbols.includes(s)),
    },
  ].filter((g) => g.symbols.length > 0);

  // Selected symbol quote details
  const selectedQuote = props.quotes.get(props.selectedSymbol);
  const selLtp = selectedQuote?.ltp ?? 23294.70;
  const selChange = selectedQuote?.change ?? 53.15;
  const selPct = selectedQuote?.changePercent ?? 0.23;
  const selIsUp = selChange >= 0;
  const selHigh = selectedQuote?.high ?? selLtp * 1.008;
  const selLow = selectedQuote?.low ?? selLtp * 0.994;
  const selOpen = selectedQuote?.open ?? selLtp - selChange;
  const selPrevClose = selectedQuote?.prevClose ?? selLtp - selChange;
  const selVol = selectedQuote?.volume ?? 960280;

  // Day range progress percentage
  const rangeSpan = Math.max(0.1, selHigh - selLow);
  const rangePct = Math.max(0, Math.min(100, ((selLtp - selLow) / rangeSpan) * 100));

  function renderSymbolIcon(symbol: string) {
    if (symbol === "NIFTY") return <div className="tv-sym-logo nifty" title="Nifty 50">50</div>;
    if (symbol === "BANKNIFTY") return <div className="tv-sym-logo bank" title="Nifty Bank">🏛</div>;
    if (symbol === "FINNIFTY") return <div className="tv-sym-logo fin" title="Nifty Financial">₹</div>;
    if (symbol === "SENSEX") return <div className="tv-sym-logo bse" title="BSE Sensex">BSE</div>;
    if (symbol === "NIFTY500") return <div className="tv-sym-logo n500" title="Nifty 500">500</div>;
    if (symbol === "RELIANCE") return <div className="tv-sym-logo reliance" title="Reliance Industries">R</div>;
    if (symbol === "TCS") return <div className="tv-sym-logo tcs" title="Tata Consultancy Services">TCS</div>;
    if (symbol === "HDFCBANK") return <div className="tv-sym-logo hdfc" title="HDFC Bank">H</div>;
    if (symbol === "ICICIBANK") return <div className="tv-sym-logo icici" title="ICICI Bank">i</div>;
    if (symbol === "BHARTIARTL") return <div className="tv-sym-logo airtel" title="Bharti Airtel">A</div>;
    if (symbol === "BAJFINANCE") return <div className="tv-sym-logo bajaj" title="Bajaj Finance">B</div>;
    if (symbol === "BTCUSDT") return <div className="tv-sym-logo btc" title="Bitcoin">₿</div>;
    if (symbol === "ETHUSDT") return <div className="tv-sym-logo eth" title="Ethereum">Ξ</div>;
    if (symbol === "SOLUSDT") return <div className="tv-sym-logo sol" title="Solana">◎</div>;
    const letter = symbol.charAt(0);
    return <div className={`tv-sym-logo char ${letter.toLowerCase()}`} title={symbol}>{letter}</div>;
  }

  return (
    <div className={`tv-watchlist ${props.compact ? "compact" : ""}`}>
      {/* 1. Header: Watchlist Name Dropdown & Add Button (Hidden in compact mode) */}
      {!props.compact && (
        <div className="tv-wl-header">
          <div className="tv-wl-dropdown-wrap">
            <span className="tv-wl-label">Watchlist</span>
            <select
              className="tv-wl-select"
              value={props.activeListId}
              onChange={(e) => props.onSelectList(e.target.value)}
            >
              {props.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`tv-wl-add-toggle-btn ${showAddInput ? "active" : ""}`}
            onClick={() => setShowAddInput(!showAddInput)}
            title="Add Symbol to Watchlist (+)"
          >
            <IconPlus />
          </button>
        </div>
      )}

      {/* 2. Add Symbol Search Form */}
      {!props.compact && showAddInput && (
        <form className="tv-wl-search-form" onSubmit={handleAdd}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
          <input
            type="text"
            className="tv-wl-search-input"
            placeholder="Add symbol (e.g. RELIANCE)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button type="submit" className="tv-wl-search-submit">Add</button>
        </form>
      )}

      {/* 3. Table Column Headers (Hidden in compact mode) */}
      {!props.compact && (
        <div className="tv-wl-table-header">
          <span className="tv-wl-col symbol">Symbol</span>
          <span className="tv-wl-col last">Last</span>
          <span className="tv-wl-col chg">Chg</span>
          <span className="tv-wl-col chgpct">Chg%</span>
        </div>
      )}

      {/* 4. Watchlist Rows with Collapsible Sections */}
      <div className="tv-wl-rows-container">
        {groups.map((group) => {
          const isCollapsed = !!collapsedSections[group.id];
          return (
            <div key={group.id} className="tv-wl-group-section">
              {/* Collapsible Section Header (Matches user screenshot) */}
              <div
                className="tv-wl-section-header"
                onClick={() => toggleSection(group.id)}
                title="Click to collapse / expand section"
              >
                <span className="tv-wl-collapse-arrow">
                  {isCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                </span>
                {!props.compact && <span className="tv-wl-section-title">{group.title}</span>}
                {!props.compact && <span className="tv-wl-section-count">({group.symbols.length})</span>}
              </div>

              {/* Section Rows */}
              {!isCollapsed && (
                <div className="tv-wl-section-rows">
                  {group.symbols.map((symbol) => {
                    const q = props.quotes.get(symbol);
                    const change = q?.change ?? 0;
                    const changePct = q?.changePercent ?? 0;
                    const isUp = change >= 0;
                    const isSelected = symbol === props.selectedSymbol;

                    return (
                      <div
                        key={symbol}
                        className={`tv-wl-row ${isSelected ? "selected" : ""} ${props.compact ? "compact" : ""}`}
                        onClick={() => props.onSelectSymbol(symbol)}
                        title={`${symbol} • ₹${q ? q.ltp.toFixed(2) : "—"} (${q ? (isUp ? "+" : "") + changePct.toFixed(2) + "%" : "—"})`}
                      >
                        {/* Symbol Logo & Ticker */}
                        <div className="tv-wl-cell symbol">
                          {renderSymbolIcon(symbol)}
                          {!props.compact && (
                            <div className="tv-wl-ticker-info">
                              <span className="tv-wl-ticker">{symbol}</span>
                              <span className="tv-wl-exch">NSE</span>
                            </div>
                          )}
                        </div>

                        {!props.compact && (
                          <>
                            {/* Last Price */}
                            <div className="tv-wl-cell last">
                              {q ? q.ltp.toFixed(2) : "—"}
                            </div>

                            {/* Price Change */}
                            <div className={`tv-wl-cell chg ${isUp ? "up" : "down"}`}>
                              {q ? (isUp ? `+${change.toFixed(2)}` : change.toFixed(2)) : "—"}
                            </div>

                            {/* Change % Badge */}
                            <div className="tv-wl-cell chgpct">
                              <span className={`tv-wl-badge ${isUp ? "up" : "down"}`}>
                                {q ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
                              </span>
                            </div>

                            {/* Row Hover Actions (Reorder & Remove) */}
                            <div className="tv-wl-row-actions">
                              <button
                                className="tv-wl-action-btn"
                                title="Move Up"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onReorder(activeList.id, symbol, -1);
                                }}
                              >
                                ▲
                              </button>
                              <button
                                className="tv-wl-action-btn"
                                title="Move Down"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onReorder(activeList.id, symbol, 1);
                                }}
                              >
                                ▼
                              </button>
                              <button
                                className="tv-wl-action-btn remove"
                                title="Remove Symbol"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onRemoveSymbol(activeList.id, symbol);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {activeList.symbols.length === 0 && (
          <div className="tv-empty-hint">
            Watchlist is empty. Click <b>+</b> to add symbols.
          </div>
        )}
      </div>

      {/* 5. Collapsible Bottom Details Pane (Matches user screenshot) */}
      <div className={`tv-wl-details-pane ${showDetailsPane ? "expanded" : "collapsed"} ${props.compact ? "compact" : ""}`}>
        {!props.compact && (
          <div className="tv-wl-details-toggle-bar" onClick={() => setShowDetailsPane(!showDetailsPane)}>
            <span className="tv-wl-drag-pill" />
            <span className="tv-wl-details-toggle-title">
              {showDetailsPane ? "▼ Key Statistics" : "▲ Expand Details"}
            </span>
          </div>
        )}

        {showDetailsPane && (
          <div className="tv-wl-details-body">
            {/* Symbol Header */}
            <div className={`tv-wl-details-header ${props.compact ? "compact" : ""}`}>
              <div className="tv-wl-details-logo">
                {renderSymbolIcon(props.selectedSymbol)}
              </div>
              <div className="tv-wl-details-names">
                <div className="tv-wl-details-full-title">
                  <b>{props.compact ? props.selectedSymbol.slice(0, 4) : props.selectedSymbol}</b>
                  {!props.compact && <span>{props.selectedSymbol === "NIFTY" ? "Nifty 50 Index" : `${props.selectedSymbol} Ltd`}</span>}
                </div>
                <span className="tv-wl-details-type">
                  {props.compact ? "NSE" : (indexSymbols.includes(props.selectedSymbol) ? "Index • NSE" : "Stock • NSE")}
                </span>
              </div>
            </div>

            {/* Big Price & Change */}
            <div className={`tv-wl-details-price-row ${props.compact ? "compact" : ""}`}>
              <div className="tv-wl-big-price">{props.compact ? (selLtp >= 10000 ? `${(selLtp / 1000).toFixed(1)}k` : selLtp.toFixed(0)) : selLtp.toFixed(2)}</div>
              <div className={`tv-wl-big-change ${selIsUp ? "up" : "down"}`}>
                {selIsUp ? `+${selChange.toFixed(1)}` : selChange.toFixed(1)} {!props.compact && `(${selIsUp ? "+" : ""}${selPct.toFixed(2)}%)`}
              </div>
            </div>

            {/* Day Range Bar */}
            <div className={`tv-wl-range-section ${props.compact ? "compact" : ""}`}>
              {!props.compact && (
                <div className="tv-wl-range-labels">
                  <span>Low <b>{selLow.toFixed(2)}</b></span>
                  <span className="range-title">Day's Range</span>
                  <span>High <b>{selHigh.toFixed(2)}</b></span>
                </div>
              )}
              <div className="tv-wl-range-bar-track">
                <div className="tv-wl-range-bar-fill" style={{ width: `${rangePct}%` }} />
                <div className="tv-wl-range-bar-pointer" style={{ left: `${rangePct}%` }} />
              </div>
            </div>

            {/* Key Metrics Grid */}
            {!props.compact && (
              <div className="tv-wl-metrics-grid">
                <div className="tv-wl-metric-item">
                  <span className="metric-lbl">Open</span>
                  <span className="metric-val">{selOpen.toFixed(2)}</span>
                </div>
                <div className="tv-wl-metric-item">
                  <span className="metric-lbl">Prev Close</span>
                  <span className="metric-val">{selPrevClose.toFixed(2)}</span>
                </div>
                <div className="tv-wl-metric-item">
                  <span className="metric-lbl">Volume</span>
                  <span className="metric-val">{(selVol / 1000).toFixed(1)} K</span>
                </div>
                <div className="tv-wl-metric-item">
                  <span className="metric-lbl">52W High</span>
                  <span className="metric-val">{(selLtp * 1.15).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";

export interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  currentSymbol: string;
}

interface SymbolItem {
  ticker: string;
  name: string;
  exchange: string;
  type: "stock" | "index" | "crypto" | "forex";
  country: string;
}

const ALL_SYMBOLS: SymbolItem[] = [
  { ticker: "NIFTY", name: "Nifty 50 Index", exchange: "NSE", type: "index", country: "IN" },
  { ticker: "BANKNIFTY", name: "Nifty Bank Index", exchange: "NSE", type: "index", country: "IN" },
  { ticker: "FINNIFTY", name: "Nifty Financial Services", exchange: "NSE", type: "index", country: "IN" },
  { ticker: "RELIANCE", name: "Reliance Industries Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "TCS", name: "Tata Consultancy Services", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "INFY", name: "Infosys Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "HDFCBANK", name: "HDFC Bank Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "ICICIBANK", name: "ICICI Bank Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "SBIN", name: "State Bank of India", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "TATAMOTORS", name: "Tata Motors Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "ADANIENT", name: "Adani Enterprises Ltd", exchange: "NSE", type: "stock", country: "IN" },
  { ticker: "BTCUSDT", name: "Bitcoin / TetherUS", exchange: "BINANCE", type: "crypto", country: "GLOBAL" },
  { ticker: "ETHUSDT", name: "Ethereum / TetherUS", exchange: "BINANCE", type: "crypto", country: "GLOBAL" },
  { ticker: "USDINR", name: "US Dollar / Indian Rupee", exchange: "FX", type: "forex", country: "GLOBAL" },
  { ticker: "AAPL", name: "Apple Inc", exchange: "NASDAQ", type: "stock", country: "US" },
  { ticker: "TSLA", name: "Tesla Inc", exchange: "NASDAQ", type: "stock", country: "US" },
  { ticker: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "stock", country: "US" },
];

export function SymbolSearchModal(props: SymbolSearchModalProps) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  if (!props.isOpen) return null;

  const filtered = ALL_SYMBOLS.filter((s) => {
    const matchesQuery = s.ticker.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase());
    const matchesType = filterType === "all" || s.type === filterType;
    return matchesQuery && matchesType;
  });

  return (
    <div className="tv-modal-backdrop" onClick={props.onClose}>
      <div className="tv-modal-content symbol-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-header">
          <div className="tv-search-input-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5" />
              <line x1="12" y1="12" x2="16" y2="16" />
            </svg>
            <input
              type="text"
              className="tv-search-input"
              placeholder="Search symbol, e.g. NIFTY, RELIANCE, BTCUSDT..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button className="tv-modal-close-btn" onClick={props.onClose}>✕</button>
        </div>

        {/* Categories Bar */}
        <div className="tv-symbol-tabs">
          {["all", "stock", "index", "crypto", "forex"].map((t) => (
            <button
              key={t}
              className={`tv-sym-tab-btn ${filterType === t ? "active" : ""}`}
              onClick={() => setFilterType(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="tv-symbol-results">
          {filtered.map((s) => (
            <div
              key={s.ticker}
              className={`tv-symbol-row ${props.currentSymbol === s.ticker ? "active" : ""}`}
              onClick={() => {
                props.onSelectSymbol(s.ticker);
                props.onClose();
              }}
            >
              <div className="tv-sym-cell-ticker">
                <b>{s.ticker}</b>
                <span className="tv-sym-name">{s.name}</span>
              </div>
              <div className="tv-sym-cell-meta">
                <span className="tv-sym-type-badge">{s.type.toUpperCase()}</span>
                <span className="tv-sym-exchange">{s.exchange}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="tv-no-results">No matching symbols found</div>
          )}
        </div>
      </div>
    </div>
  );
}

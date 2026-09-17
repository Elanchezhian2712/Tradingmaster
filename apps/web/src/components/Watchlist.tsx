import { useState } from "react";
import { WatchlistDef, WatchlistQuoteRow } from "../types";

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
}

export function Watchlist(props: WatchlistProps) {
  const [search, setSearch] = useState("");
  const activeList = props.lists.find((l) => l.id === props.activeListId) ?? props.lists[0]!;

  return (
    <div className="watchlist">
      <div className="watchlist-tabs">
        {props.lists.map((l) => (
          <button key={l.id} className={l.id === props.activeListId ? "wl-tab active" : "wl-tab"} onClick={() => props.onSelectList(l.id)}>
            {l.name}
          </button>
        ))}
      </div>

      <div className="watchlist-search">
        <input
          placeholder="Add symbol (e.g. RELIANCE)"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim()) {
              props.onAddSymbol(activeList.id, search.trim());
              setSearch("");
            }
          }}
        />
      </div>

      <div className="watchlist-header">
        <span>Symbol</span>
        <span>LTP</span>
        <span>Chg%</span>
      </div>
      <ul className="watchlist-rows">
        {activeList.symbols.map((symbol) => {
          const q = props.quotes.get(symbol);
          const up = (q?.change ?? 0) >= 0;
          return (
            <li
              key={symbol}
              className={symbol === props.selectedSymbol ? "wl-row selected" : "wl-row"}
              onClick={() => props.onSelectSymbol(symbol)}
            >
              <span className="wl-symbol">{symbol}</span>
              <span className="wl-ltp">{q ? q.ltp.toFixed(2) : "—"}</span>
              <span className={up ? "wl-change up" : "wl-change down"}>{q ? `${q.changePercent.toFixed(2)}%` : "—"}</span>
              <span className="wl-actions">
                <button onClick={(e) => (e.stopPropagation(), props.onReorder(activeList.id, symbol, -1))}>↑</button>
                <button onClick={(e) => (e.stopPropagation(), props.onReorder(activeList.id, symbol, 1))}>↓</button>
                <button onClick={(e) => (e.stopPropagation(), props.onRemoveSymbol(activeList.id, symbol))}>✕</button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

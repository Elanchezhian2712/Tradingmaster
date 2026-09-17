import { useState, useEffect } from "react";
import { CandleSnapshot, Timeframe } from "@trading-master/market-data";
import { ActiveIndicator } from "../types";
import { PlaceOrderRequest } from "@trading-master/paper-trading";
import { IconEye, IconEyeClosed, IconSettings, IconTrash } from "./icons";

export interface ChartOverlayHeaderProps {
  symbol: string;
  timeframe: Timeframe;
  activeIndicators: ActiveIndicator[];
  onToggleIndicator: (id: string, enabled: boolean) => void;
  onRemoveIndicator: (id: string) => void;
  onPlaceOrder: (req: PlaceOrderRequest) => void;
  lastPrice: number;
  currentBar: CandleSnapshot | null;
  volumeDisplay?: string;
}

export function ChartOverlayHeader(props: ChartOverlayHeaderProps) {
  const [orderQty, setOrderQty] = useState(25);
  const [orderNotification, setOrderNotification] = useState<string | null>(null);

  const bar = props.currentBar;
  const o = bar ? bar.open : props.lastPrice;
  const h = bar ? bar.high : props.lastPrice;
  const l = bar ? bar.low : props.lastPrice;
  const c = bar ? bar.close : props.lastPrice;
  const diff = bar ? c - o : 0;
  const pct = o > 0 ? (diff / o) * 100 : 0;
  const isUp = diff >= 0;

  const sellPrice = props.lastPrice > 0 ? (props.lastPrice - 0.05).toFixed(2) : "23,270.60";
  const buyPrice = props.lastPrice > 0 ? (props.lastPrice + 0.05).toFixed(2) : "23,270.60";

  function handleQuickBuy() {
    props.onPlaceOrder({
      symbol: props.symbol,
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: orderQty,
    });
    showToast(`Executed BUY ${orderQty} ${props.symbol} @ Market`);
  }

  function handleQuickSell() {
    props.onPlaceOrder({
      symbol: props.symbol,
      side: "SELL",
      type: "MARKET",
      product: "MIS",
      quantity: orderQty,
    });
    showToast(`Executed SELL ${orderQty} ${props.symbol} @ Market`);
  }

  function showToast(msg: string) {
    setOrderNotification(msg);
    setTimeout(() => setOrderNotification(null), 3500);
  }

  return (
    <div className="tv-chart-overlay-header">
      {/* Toast Notification */}
      {orderNotification && (
        <div className="tv-order-toast">
          <span>✓</span> {orderNotification}
        </div>
      )}

      {/* Row 1: Symbol Title & Details, OHLC Readout */}
      <div className="tv-overlay-top-row">
        <div className="tv-symbol-title-group">
          <span className="tv-badge-index">50</span>
          <span className="tv-symbol-full-name">{props.symbol === "NIFTY" ? "Nifty 50 Index" : props.symbol}</span>
          <span className="tv-dot-sep">•</span>
          <span className="tv-tf-readout">{props.timeframe}</span>
          <span className="tv-dot-sep">•</span>
          <span className="tv-exchange-readout">NSE</span>
          <span className="tv-market-status-dot" title="Real-time Market Data">D</span>
        </div>

        {bar && (
          <div className="tv-ohlc-stats">
            <span className="tv-ohlc-stat">O<b className={isUp ? "up" : "down"}>{o.toFixed(2)}</b></span>
            <span className="tv-ohlc-stat">H<b className={isUp ? "up" : "down"}>{h.toFixed(2)}</b></span>
            <span className="tv-ohlc-stat">L<b className={isUp ? "up" : "down"}>{l.toFixed(2)}</b></span>
            <span className="tv-ohlc-stat">C<b className={isUp ? "up" : "down"}>{c.toFixed(2)}</b></span>
            <span className={`tv-ohlc-change ${isUp ? "up" : "down"}`}>
              {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} ({isUp ? "+" : ""}{pct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Row 2: Instant Buy/Sell Execution Box (Matches user screenshot) */}
      <div className="tv-overlay-execution-row">
        <div className="tv-quick-trade-widget">
          <button className="tv-trade-btn sell" onClick={handleQuickSell} title="Execute Instant Market Sell Order">
            <div className="tv-trade-price">{sellPrice}</div>
            <div className="tv-trade-action">SELL</div>
          </button>

          <div className="tv-trade-spread" title="Bid-Ask Spread / Order Quantity">
            <input
              type="number"
              min="1"
              step="25"
              value={orderQty}
              onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="tv-trade-qty-input"
              title="Order Quantity (Contracts / Shares)"
            />
            <span className="tv-spread-val">0.00</span>
          </div>

          <button className="tv-trade-btn buy" onClick={handleQuickBuy} title="Execute Instant Market Buy Order">
            <div className="tv-trade-price">{buyPrice}</div>
            <div className="tv-trade-action">BUY</div>
          </button>
        </div>
      </div>

      {/* Row 3: Active Indicators (e.g. Vol 960.28 K) */}
      <div className="tv-overlay-indicators-row">
        <div className="tv-indicator-badge">
          <span className="tv-ind-name">Vol</span>
          <span className="tv-ind-val">{props.volumeDisplay || "960.28 K"}</span>
        </div>

        {props.activeIndicators.map((ind) => (
          <div key={ind.id} className={`tv-indicator-badge ${!ind.enabled ? "dimmed" : ""}`}>
            <span className="tv-ind-name">{ind.label}</span>
            <div className="tv-ind-controls">
              <button
                className="tv-ind-btn"
                title={ind.enabled ? "Hide" : "Show"}
                onClick={() => props.onToggleIndicator(ind.id, !ind.enabled)}
              >
                {ind.enabled ? <IconEye /> : <IconEyeClosed />}
              </button>
              <button
                className="tv-ind-btn"
                title="Settings"
              >
                <IconSettings />
              </button>
              <button
                className="tv-ind-btn"
                title="Remove Indicator"
                onClick={() => props.onRemoveIndicator(ind.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

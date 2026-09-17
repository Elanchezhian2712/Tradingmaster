import { useState } from "react";
import { Order, PositionValuation, ProductType, Trade } from "@trading-master/paper-trading";
import { PaperTradingSnapshot } from "../usePaperTrading";

type DockTab = "positions" | "orders" | "trades";

export interface TradingDockProps {
  snapshot: PaperTradingSnapshot;
  onClosePosition: (symbol: string, product: ProductType) => void;
  onCancelOrder: (orderId: string) => void;
  onSquareOffAll: () => void;
  onSelectSymbol: (symbol: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export function TradingDock(props: TradingDockProps) {
  const [tab, setTab] = useState<DockTab>("positions");
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = props.collapsed !== undefined ? props.collapsed : localCollapsed;

  function toggleCollapse() {
    const next = !collapsed;
    setLocalCollapsed(next);
    props.onToggleCollapse?.(next);
  }

  function handleTabSelect(newTab: DockTab) {
    setTab(newTab);
    setLocalCollapsed(false);
    props.onToggleCollapse?.(false);
  }

  const { positions, orders, trades, account } = props.snapshot;
  const openOrders = orders.filter((o) => o.status === "open" || o.status === "triggered");
  const dayPnl = account.realizedPnl + account.unrealizedPnl;

  return (
    <div className={collapsed ? "trading-dock collapsed" : "trading-dock"}>
      <div className="dock-bar">
        <div className="dock-tabs">
          <DockTabButton label={`Positions (${positions.length})`} active={tab === "positions"} onClick={() => handleTabSelect("positions")} />
          <DockTabButton label={`Orders (${openOrders.length})`} active={tab === "orders"} onClick={() => handleTabSelect("orders")} />
          <DockTabButton label={`Trades (${trades.length})`} active={tab === "trades"} onClick={() => handleTabSelect("trades")} />
        </div>

        <div className="dock-summary">
          <Stat label="P&L" value={money(dayPnl)} tone={tone(dayPnl)} />
          <Stat label="Realised" value={money(account.realizedPnl)} tone={tone(account.realizedPnl)} />
          <Stat label="Unrealised" value={money(account.unrealizedPnl)} tone={tone(account.unrealizedPnl)} />
          <Stat label="Available" value={money(account.availableBalance)} />
          <Stat label="Equity" value={money(account.equity)} />
          <button className="tv-dock-action-btn" onClick={props.onSquareOffAll} disabled={positions.length === 0 && openOrders.length === 0}>
            Square off all
          </button>
          {props.onToggleMaximize && (
            <button
              className="tv-dock-icon-btn"
              onClick={props.onToggleMaximize}
              title={props.maximized ? "Restore Height" : "Maximize Panel"}
              aria-label="Maximize panel"
            >
              {props.maximized ? "🗗" : "🗖"}
            </button>
          )}
          <button
            className="tv-dock-icon-btn tv-dock-toggle-btn"
            onClick={toggleCollapse}
            aria-label="Toggle panel"
            title={collapsed ? "Expand Panel (▲)" : "Collapse Panel (▼)"}
          >
            {collapsed ? "▲" : "▼"}
          </button>
          {props.onClose && (
            <button className="tv-dock-icon-btn tv-dock-close-btn" onClick={props.onClose} title="Close Panel" aria-label="Close panel">
              ✕
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="dock-body">
          {tab === "positions" && <PositionsTable positions={positions} onClose={props.onClosePosition} onSelectSymbol={props.onSelectSymbol} />}
          {tab === "orders" && <OrdersTable orders={orders} onCancel={props.onCancelOrder} onSelectSymbol={props.onSelectSymbol} />}
          {tab === "trades" && <TradesTable trades={trades} onSelectSymbol={props.onSelectSymbol} />}
        </div>
      )}
    </div>
  );
}

function DockTabButton(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={props.active ? "dock-tab active" : "dock-tab"} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function Stat(props: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <span className="dock-stat">
      <span className="dock-stat-label">{props.label}</span>
      <b className={props.tone ? `dock-stat-value ${props.tone}` : "dock-stat-value"}>{props.value}</b>
    </span>
  );
}

function PositionsTable(props: {
  positions: PositionValuation[];
  onClose: (symbol: string, product: ProductType) => void;
  onSelectSymbol: (symbol: string) => void;
}) {
  if (props.positions.length === 0) return <EmptyRow text="No open positions" />;
  return (
    <table className="dock-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Avg</th>
          <th>LTP</th>
          <th>P&L</th>
          <th>Chg%</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.positions.map((p) => (
          <tr key={`${p.symbol}:${p.product}`} onClick={() => props.onSelectSymbol(p.symbol)}>
            <td className="dock-symbol">{p.symbol}</td>
            <td>{p.product}</td>
            <td className={p.quantity > 0 ? "up" : "down"}>{p.quantity}</td>
            <td>{p.averagePrice.toFixed(2)}</td>
            <td>{p.lastPrice.toFixed(2)}</td>
            <td className={tone(p.unrealizedPnl)}>{money(p.unrealizedPnl)}</td>
            <td className={tone(p.unrealizedPnl)}>{p.unrealizedPnlPercent.toFixed(2)}%</td>
            <td>
              <button
                className="icon-btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onClose(p.symbol, p.product);
                }}
              >
                Exit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdersTable(props: { orders: Order[]; onCancel: (orderId: string) => void; onSelectSymbol: (symbol: string) => void }) {
  if (props.orders.length === 0) return <EmptyRow text="No orders yet" />;
  return (
    <table className="dock-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Type</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.orders.map((o) => {
          const resting = o.status === "open" || o.status === "triggered";
          return (
            <tr key={o.id} onClick={() => props.onSelectSymbol(o.symbol)} title={o.rejectionReason ?? ""}>
              <td>{time(o.createdAt)}</td>
              <td className="dock-symbol">{o.symbol}</td>
              <td className={o.side === "BUY" ? "up" : "down"}>{o.side}</td>
              <td>
                {o.type}
                {o.legType && <span className="dock-leg-tag">{o.legType === "stop-loss" ? "SL leg" : "target leg"}</span>}
              </td>
              <td>{o.product}</td>
              <td>{o.quantity}</td>
              <td>{orderPrice(o)}</td>
              <td className={`status-${o.status}`}>{o.status}</td>
              <td>
                {resting && (
                  <button
                    className="icon-btn small"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onCancel(o.id);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TradesTable(props: { trades: Trade[]; onSelectSymbol: (symbol: string) => void }) {
  if (props.trades.length === 0) return <EmptyRow text="No closed trades yet" />;
  return (
    <table className="dock-table">
      <thead>
        <tr>
          <th>Exit time</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Qty</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>P&L</th>
        </tr>
      </thead>
      <tbody>
        {props.trades.map((t) => (
          <tr key={t.id} onClick={() => props.onSelectSymbol(t.symbol)}>
            <td>{time(t.exitTime)}</td>
            <td className="dock-symbol">{t.symbol}</td>
            <td className={t.side === "BUY" ? "up" : "down"}>{t.side === "BUY" ? "LONG" : "SHORT"}</td>
            <td>{t.quantity}</td>
            <td>{t.entryPrice.toFixed(2)}</td>
            <td>{t.exitPrice.toFixed(2)}</td>
            <td className={tone(t.pnl)}>{money(t.pnl)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyRow(props: { text: string }) {
  return <div className="dock-empty">{props.text}</div>;
}

function orderPrice(order: Order): string {
  if (order.status === "filled" && order.averageFillPrice !== undefined) return order.averageFillPrice.toFixed(2);
  if (order.limitPrice !== undefined) return order.limitPrice.toFixed(2);
  if (order.triggerPrice !== undefined) return `trg ${order.triggerPrice.toFixed(2)}`;
  return "MKT";
}

function tone(value: number): "up" | "down" {
  return value >= 0 ? "up" : "down";
}

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function time(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("en-IN", { hour12: false });
}

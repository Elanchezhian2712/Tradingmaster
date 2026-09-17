import { useEffect, useState } from "react";
import { Order, OrderSide, OrderType, PlaceOrderRequest, ProductType } from "@trading-master/paper-trading";

const ORDER_TYPES: OrderType[] = ["MARKET", "LIMIT", "SL", "SL-M"];
const PRODUCTS: ProductType[] = ["MIS", "CNC", "NRML"];

export interface OrderTicketProps {
  symbol: string;
  /** Last traded price for `symbol`, or undefined before the first price arrives. */
  ltp: number | undefined;
  availableBalance: number;
  onPlace: (req: PlaceOrderRequest) => Order;
}

interface TicketFeedback {
  tone: "ok" | "error";
  text: string;
}

export function OrderTicket(props: OrderTicketProps) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [quantity, setQuantity] = useState("1");
  const [product, setProduct] = useState<ProductType>("MIS");
  const [type, setType] = useState<OrderType>("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [feedback, setFeedback] = useState<TicketFeedback | null>(null);

  // Prefill the price fields from the market when switching away from MARKET,
  // so the user edits a sensible number instead of an empty box.
  useEffect(() => {
    if (type === "MARKET" || props.ltp === undefined) return;
    const seed = props.ltp.toFixed(2);
    setLimitPrice((v) => (v === "" ? seed : v));
    setTriggerPrice((v) => (v === "" ? seed : v));
    // Intentionally keyed on `type` only: re-seeding on every LTP tick would
    // fight the user while they type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => setFeedback(null), [props.symbol]);

  // Seed the legs a sensible distance either side of the market the first time
  // the bracket is switched on, so the user adjusts numbers instead of typing
  // them from nothing.
  useEffect(() => {
    if (!bracketEnabled || props.ltp === undefined) return;
    const away = props.ltp * 0.01;
    const loss = side === "BUY" ? props.ltp - away : props.ltp + away;
    const gain = side === "BUY" ? props.ltp + away : props.ltp - away;
    setStopLossPrice((v) => (v === "" ? loss.toFixed(2) : v));
    setTargetPrice((v) => (v === "" ? gain.toFixed(2) : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketEnabled, side]);

  const needsLimit = type === "LIMIT" || type === "SL";
  const needsTrigger = type === "SL" || type === "SL-M";
  const qty = Number(quantity);
  const referencePrice = needsLimit ? Number(limitPrice) : props.ltp ?? 0;
  const orderValue = Number.isFinite(qty) && Number.isFinite(referencePrice) ? qty * referencePrice : 0;

  function submit(): void {
    const req: PlaceOrderRequest = {
      symbol: props.symbol,
      side,
      type,
      product,
      quantity: Number(quantity),
      ...(needsLimit ? { limitPrice: Number(limitPrice) } : {}),
      ...(needsTrigger ? { triggerPrice: Number(triggerPrice) } : {}),
      ...(bracketEnabled
        ? {
            bracket: {
              ...(stopLossPrice !== "" ? { stopLossPrice: Number(stopLossPrice) } : {}),
              ...(targetPrice !== "" ? { targetPrice: Number(targetPrice) } : {}),
            },
          }
        : {}),
    };
    const order = props.onPlace(req);
    if (order.status === "rejected") {
      setFeedback({ tone: "error", text: `Rejected: ${order.rejectionReason ?? "unknown reason"}` });
    } else if (order.status === "filled") {
      const withBracket = bracketEnabled ? ", bracket placed" : "";
      setFeedback({
        tone: "ok",
        text: `${order.side} ${order.quantity} filled @ ${order.averageFillPrice?.toFixed(2)}${withBracket}`,
      });
    } else {
      setFeedback({ tone: "ok", text: `${order.side} ${order.quantity} ${order.type} order placed` });
    }
  }

  return (
    <div className="order-ticket">
      <div className="panel-title">Order — {props.symbol}</div>

      <div className="ticket-side">
        <button className={side === "BUY" ? "side-btn buy active" : "side-btn buy"} onClick={() => setSide("BUY")}>
          BUY
        </button>
        <button className={side === "SELL" ? "side-btn sell active" : "side-btn sell"} onClick={() => setSide("SELL")}>
          SELL
        </button>
      </div>

      <div className="ticket-grid">
        <label>
          Qty
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label="Quantity"
          />
        </label>
        <label>
          Product
          <select value={product} onChange={(e) => setProduct(e.target.value as ProductType)} aria-label="Product">
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as OrderType)} aria-label="Order type">
            {ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={needsLimit ? "" : "disabled"}>
          Limit
          <input
            type="number"
            step="0.05"
            value={needsLimit ? limitPrice : ""}
            disabled={!needsLimit}
            onChange={(e) => setLimitPrice(e.target.value)}
            aria-label="Limit price"
          />
        </label>
        <label className={needsTrigger ? "" : "disabled"}>
          Trigger
          <input
            type="number"
            step="0.05"
            value={needsTrigger ? triggerPrice : ""}
            disabled={!needsTrigger}
            onChange={(e) => setTriggerPrice(e.target.value)}
            aria-label="Trigger price"
          />
        </label>
        <div className="ticket-ltp">
          LTP
          <b>{props.ltp === undefined ? "—" : props.ltp.toFixed(2)}</b>
        </div>
      </div>

      <label className="ticket-bracket-toggle">
        <input type="checkbox" checked={bracketEnabled} onChange={(e) => setBracketEnabled(e.target.checked)} />
        Bracket (stop-loss + target)
      </label>

      {bracketEnabled && (
        <div className="ticket-grid">
          <label>
            Stop-loss
            <input
              type="number"
              step="0.05"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              aria-label="Stop-loss price"
            />
          </label>
          <label>
            Target
            <input
              type="number"
              step="0.05"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              aria-label="Target price"
            />
          </label>
        </div>
      )}

      <div className="ticket-summary">
        <span>Order value</span>
        <b>{formatMoney(orderValue)}</b>
      </div>
      <div className="ticket-summary">
        <span>Available</span>
        <b>{formatMoney(props.availableBalance)}</b>
      </div>

      <button className={side === "BUY" ? "place-btn buy" : "place-btn sell"} onClick={submit}>
        Place {side} order
      </button>

      {feedback && <div className={`ticket-feedback ${feedback.tone}`}>{feedback.text}</div>}
      <div className="ticket-note">Paper trading — simulated fills against the mock feed. No real order is sent.</div>
    </div>
  );
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

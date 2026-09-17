/**
 * Paper-trading domain types. Deliberately provider-agnostic: the engine is
 * driven by (symbol, price, timestamp) updates from whatever feed the app is
 * running — the mock provider today, a real vendor later — and never talks to
 * a broker itself.
 */

export type OrderSide = "BUY" | "SELL";

/**
 * Indian-market order types:
 * - MARKET  fills at the next known price
 * - LIMIT   rests until price is at or better than `limitPrice`
 * - SL      stop-limit: on `triggerPrice` it becomes a LIMIT at `limitPrice`
 * - SL-M    stop-market: on `triggerPrice` it fills at the triggering price
 */
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";

/**
 * Product tags follow Indian broker conventions and are carried through to
 * positions (MIS intraday positions are netted separately from CNC delivery).
 * They do NOT imply leverage here: paper trading is 1x on every product,
 * because real margin multipliers are broker-specific and are not invented.
 */
export type ProductType = "MIS" | "CNC" | "NRML";

export type OrderStatus = "open" | "triggered" | "filled" | "cancelled" | "rejected";

/**
 * Protective legs attached to an entry order. Both are placed automatically
 * once the entry fills, in the opposite direction and for the same quantity,
 * and they cancel each other: whichever one fills first takes the position
 * flat, so the other must not stay resting and re-open it.
 */
export interface BracketSpec {
  /** Trigger price of the protective stop leg (placed as SL-M). */
  stopLossPrice?: number;
  /** Limit price of the take-profit leg (placed as LIMIT). */
  targetPrice?: number;
}

/** What a bracket child order is for. Absent on ordinary orders. */
export type OrderLegType = "stop-loss" | "target";

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  product: ProductType;
  quantity: number;
  filledQuantity: number;
  /** Required for LIMIT and SL. */
  limitPrice?: number;
  /** Required for SL and SL-M. */
  triggerPrice?: number;
  status: OrderStatus;
  /** Set once any quantity fills. */
  averageFillPrice?: number;
  rejectionReason?: string;
  /** Protective legs to place once this (entry) order fills. */
  bracket?: BracketSpec;
  /** The entry order this leg protects, when this order is a bracket child. */
  parentOrderId?: string;
  /** One-cancels-other group: when one member fills or is cancelled, the others are cancelled. */
  ocoGroup?: string;
  legType?: OrderLegType;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  product: ProductType;
  quantity: number;
  limitPrice?: number;
  triggerPrice?: number;
  /** Attach a stop-loss and/or target, placed automatically once this order fills. */
  bracket?: BracketSpec;
}

export interface ModifyOrderRequest {
  quantity?: number;
  limitPrice?: number;
  triggerPrice?: number;
}

/** One execution against one order. */
export interface Fill {
  orderId: string;
  symbol: string;
  side: OrderSide;
  product: ProductType;
  quantity: number;
  price: number;
  /** Charges applied to this fill by the configured charges model. */
  charges: number;
  timestamp: number;
}

/**
 * Netted position, keyed by symbol+product. `quantity` is signed: positive is
 * long, negative is short, zero means flat (a flat position is dropped).
 */
export interface Position {
  symbol: string;
  product: ProductType;
  quantity: number;
  /** Average entry price of the currently open quantity. */
  averagePrice: number;
  /** Booked P&L on this symbol+product since the engine was created, net of charges. */
  realizedPnl: number;
  /** Total charges paid on this symbol+product. */
  charges: number;
  openedAt: number;
  updatedAt: number;
}

/** A closed round-trip, recorded whenever a fill reduces or flips a position. */
export interface Trade {
  id: string;
  symbol: string;
  product: ProductType;
  /** Side of the *entry* leg: BUY for a closed long, SELL for a closed short. */
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  /** Gross P&L minus the charges attributed to this exit. */
  pnl: number;
  charges: number;
  entryTime: number;
  exitTime: number;
}

export interface PositionValuation extends Position {
  /** Last price seen for this symbol, or the average price when no price has arrived yet. */
  lastPrice: number;
  unrealizedPnl: number;
  /** Unrealized P&L as a percentage of the position's entry value. */
  unrealizedPnlPercent: number;
  value: number;
}

export interface AccountSnapshot {
  startingBalance: number;
  /** Cash left after margin blocked by open positions and resting orders. */
  availableBalance: number;
  /** Entry value of all open positions. */
  usedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalCharges: number;
  /** availableBalance + usedMargin + unrealizedPnl. */
  equity: number;
}

/**
 * Charges applied per fill. Defaults to zero: real brokerage, STT, exchange
 * and GST rates are broker/segment specific and are not hardcoded here — the
 * app passes its own model if the user configures one.
 */
export type ChargesModel = (fill: Omit<Fill, "charges">) => number;

export const ZERO_CHARGES: ChargesModel = () => 0;

export interface PaperTradingEngineOptions {
  startingBalance?: number;
  charges?: ChargesModel;
  /** Injectable for deterministic tests. */
  now?: () => number;
  idFactory?: () => string;
}

export type PaperTradingEvent =
  | { type: "order"; order: Order }
  | { type: "fill"; fill: Fill; order: Order }
  | { type: "position"; position: Position | null; symbol: string; product: ProductType }
  | { type: "trade"; trade: Trade }
  | { type: "price"; symbol: string; price: number };

export type PaperTradingListener = (event: PaperTradingEvent) => void;

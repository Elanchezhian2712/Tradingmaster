import {
  AccountSnapshot,
  ChargesModel,
  Fill,
  ModifyOrderRequest,
  Order,
  OrderLegType,
  OrderSide,
  OrderType,
  PaperTradingEngineOptions,
  PaperTradingEvent,
  PaperTradingListener,
  PlaceOrderRequest,
  Position,
  PositionValuation,
  ProductType,
  Trade,
  ZERO_CHARGES,
} from "./types";

const DEFAULT_STARTING_BALANCE = 1_000_000;

function positionKey(symbol: string, product: ProductType): string {
  return `${symbol}:${product}`;
}

/**
 * Simulated order book and position keeper.
 *
 * It is deliberately a plain class with no I/O: the app feeds it prices via
 * `onPrice()` and it answers with orders, fills, positions and trades. That
 * keeps it unit-testable to the rupee, and makes it reusable later by the
 * backtest engine (historical replay) and a strategy runner, which need the
 * same fill semantics as the manual order ticket.
 *
 * Simplifications, all deliberate, none of them invented market data:
 * - fills are all-or-nothing (no partial fills, no queue position, no depth)
 * - every product is 1x margin; real broker leverage is not modelled
 * - charges default to zero unless the app supplies a `ChargesModel`
 */
export class PaperTradingEngine {
  private readonly startingBalance: number;
  private readonly charges: ChargesModel;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  private orders = new Map<string, Order>();
  private positions = new Map<string, Position>();
  private trades: Trade[] = [];
  private lastPrices = new Map<string, number>();
  private grossRealizedPnl = 0;
  private totalCharges = 0;
  private idCounter = 0;
  private listeners = new Set<PaperTradingListener>();

  constructor(options: PaperTradingEngineOptions = {}) {
    this.startingBalance = options.startingBalance ?? DEFAULT_STARTING_BALANCE;
    this.charges = options.charges ?? ZERO_CHARGES;
    this.now = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory ?? (() => `${Date.now().toString(36)}-${(this.idCounter++).toString(36)}`);
  }

  subscribe(listener: PaperTradingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: PaperTradingEvent): void {
    for (const l of this.listeners) l(event);
  }

  // ---- price feed ----

  /**
   * Feed a price for a symbol. Drives both mark-to-market and order matching,
   * so a symbol with no price updates simply never has its resting orders
   * triggered — nothing fills against a stale or fabricated price.
   */
  onPrice(symbol: string, price: number, timestamp: number = this.now()): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.lastPrices.set(symbol, price);
    this.emit({ type: "price", symbol, price });
    this.matchRestingOrders(symbol, price, timestamp);
  }

  getLastPrice(symbol: string): number | undefined {
    return this.lastPrices.get(symbol);
  }

  // ---- orders ----

  placeOrder(req: PlaceOrderRequest): Order {
    const timestamp = this.now();
    const order: Order = {
      id: this.idFactory(),
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      product: req.product,
      quantity: req.quantity,
      filledQuantity: 0,
      limitPrice: req.limitPrice,
      triggerPrice: req.triggerPrice,
      bracket: req.bracket,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const rejection = this.validate(order);
    if (rejection) return this.reject(order, rejection);

    this.orders.set(order.id, order);
    this.emit({ type: "order", order });

    const last = this.lastPrices.get(order.symbol);
    if (last !== undefined) this.tryFill(order, last, timestamp);
    return this.orders.get(order.id) ?? order;
  }

  private validate(order: Order): string | null {
    if (!Number.isInteger(order.quantity) || order.quantity <= 0) return "Quantity must be a positive whole number";
    if ((order.type === "LIMIT" || order.type === "SL") && !isPositive(order.limitPrice)) return "Limit price required";
    if ((order.type === "SL" || order.type === "SL-M") && !isPositive(order.triggerPrice)) return "Trigger price required";

    const last = this.lastPrices.get(order.symbol);
    if (last === undefined) {
      // A resting order is fine without a price (it matches when one arrives);
      // a MARKET order has nothing to fill against.
      if (order.type === "MARKET") return `No live price for ${order.symbol} yet`;
    } else if (order.type === "SL" || order.type === "SL-M") {
      // A stop already through the market would fill instantly, which is never
      // what a stop order means — real brokers reject these too.
      if (order.side === "BUY" && order.triggerPrice! <= last) return "BUY trigger price must be above the last price";
      if (order.side === "SELL" && order.triggerPrice! >= last) return "SELL trigger price must be below the last price";
    }

    if (order.bracket) {
      const bracketRejection = this.validateBracket(order);
      if (bracketRejection) return bracketRejection;
    }

    if (this.marginRequiredFor(order) > this.availableBalance()) return "Insufficient funds";
    return null;
  }

  /**
   * A bracket only makes sense on an entry order whose direction is known:
   * the stop has to sit on the losing side of the entry and the target on the
   * winning side, or the legs would fire the moment they are placed.
   */
  private validateBracket(order: Order): string | null {
    const { stopLossPrice, targetPrice } = order.bracket!;
    if (!isPositive(stopLossPrice) && !isPositive(targetPrice)) return "Bracket needs a stop-loss or a target";
    if (stopLossPrice !== undefined && !isPositive(stopLossPrice)) return "Stop-loss price must be positive";
    if (targetPrice !== undefined && !isPositive(targetPrice)) return "Target price must be positive";

    const reference = order.limitPrice ?? this.lastPrices.get(order.symbol);
    if (reference === undefined) return `No live price for ${order.symbol} yet`;

    if (order.side === "BUY") {
      if (isPositive(stopLossPrice) && stopLossPrice >= reference) return "Stop-loss must be below the entry price for a BUY";
      if (isPositive(targetPrice) && targetPrice <= reference) return "Target must be above the entry price for a BUY";
    } else {
      if (isPositive(stopLossPrice) && stopLossPrice <= reference) return "Stop-loss must be above the entry price for a SELL";
      if (isPositive(targetPrice) && targetPrice >= reference) return "Target must be below the entry price for a SELL";
    }
    return null;
  }

  private reject(order: Order, reason: string): Order {
    const rejected: Order = { ...order, status: "rejected", rejectionReason: reason, updatedAt: this.now() };
    this.orders.set(rejected.id, rejected);
    this.emit({ type: "order", order: rejected });
    return rejected;
  }

  cancelOrder(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    if (!order || !isRestingStatus(order.status)) return null;
    const cancelled: Order = { ...order, status: "cancelled", updatedAt: this.now() };
    this.orders.set(orderId, cancelled);
    this.emit({ type: "order", order: cancelled });
    // Cancelling one leg of a bracket cancels the whole bracket, as it does at
    // a real broker — a lone surviving leg would re-open the position it was
    // meant to close. The recursion terminates because a cancelled order is no
    // longer resting.
    if (cancelled.ocoGroup) this.cancelGroup(cancelled.ocoGroup, orderId);
    return cancelled;
  }

  private cancelGroup(ocoGroup: string, exceptOrderId: string): void {
    for (const other of [...this.orders.values()]) {
      if (other.id === exceptOrderId || other.ocoGroup !== ocoGroup) continue;
      if (isRestingStatus(other.status)) this.cancelOrder(other.id);
    }
  }

  modifyOrder(orderId: string, changes: ModifyOrderRequest): Order | null {
    const previous = this.orders.get(orderId);
    if (!previous || !isRestingStatus(previous.status)) return null;

    const next: Order = {
      ...previous,
      quantity: changes.quantity ?? previous.quantity,
      limitPrice: changes.limitPrice ?? previous.limitPrice,
      triggerPrice: changes.triggerPrice ?? previous.triggerPrice,
      updatedAt: this.now(),
    };

    // Validate as if new, with the order temporarily out of the book so its own
    // currently-blocked margin is not counted against its replacement.
    this.orders.delete(orderId);
    const rejection = this.validate(next);
    if (rejection) {
      this.orders.set(orderId, previous);
      return null;
    }

    this.orders.set(orderId, next);
    this.emit({ type: "order", order: next });
    const last = this.lastPrices.get(next.symbol);
    if (last !== undefined) this.tryFill(next, last, next.updatedAt);
    return this.orders.get(orderId) ?? next;
  }

  private matchRestingOrders(symbol: string, price: number, timestamp: number): void {
    for (const order of [...this.orders.values()]) {
      if (order.symbol !== symbol || !isRestingStatus(order.status)) continue;
      this.tryFill(order, price, timestamp);
    }
  }

  /**
   * Fill semantics, deliberately conservative (never better than the market):
   * - MARKET and triggered SL-M fill at the incoming price
   * - LIMIT fills at its limit price once the market trades through it, or at
   *   the market price when it was already marketable on arrival
   * - SL becomes a LIMIT at `limitPrice` once `triggerPrice` is crossed
   */
  private tryFill(order: Order, price: number, timestamp: number): void {
    const fillPrice = this.resolveFillPrice(order, price);
    if (fillPrice === null) return;
    this.executeFill(order, fillPrice, timestamp);
  }

  private resolveFillPrice(order: Order, price: number): number | null {
    switch (order.type) {
      case "MARKET":
        return price;
      case "LIMIT":
        return limitFillPrice(order.side, order.limitPrice!, price);
      case "SL-M":
        return this.isTriggered(order, price) ? price : null;
      case "SL": {
        if (order.status !== "triggered") {
          if (!this.isTriggered(order, price)) return null;
          this.setStatus(order, "triggered");
        }
        return limitFillPrice(order.side, order.limitPrice!, price);
      }
      default:
        return null;
    }
  }

  private isTriggered(order: Order, price: number): boolean {
    return order.side === "BUY" ? price >= order.triggerPrice! : price <= order.triggerPrice!;
  }

  private setStatus(order: Order, status: Order["status"]): void {
    const next: Order = { ...order, status, updatedAt: this.now() };
    this.orders.set(order.id, next);
    this.emit({ type: "order", order: next });
  }

  private executeFill(order: Order, price: number, timestamp: number): void {
    const quantity = order.quantity - order.filledQuantity;
    const base: Omit<Fill, "charges"> = {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      product: order.product,
      quantity,
      price,
      timestamp,
    };
    const charges = Math.max(0, this.charges(base));
    const fill: Fill = { ...base, charges };
    this.totalCharges += charges;

    const filled: Order = {
      ...order,
      filledQuantity: order.quantity,
      averageFillPrice: price,
      status: "filled",
      updatedAt: timestamp,
    };
    this.orders.set(order.id, filled);

    this.applyFillToPosition(fill);
    this.emit({ type: "order", order: filled });
    this.emit({ type: "fill", fill, order: filled });

    // Order matters: the entry's own fill is reported before its protective
    // legs appear, so the UI never shows a stop for a position it has not been
    // told about yet.
    if (filled.ocoGroup) this.cancelGroup(filled.ocoGroup, filled.id);
    if (filled.bracket && !filled.parentOrderId) this.placeBracketLegs(filled, price);
  }

  /**
   * Place the protective legs of a filled entry: a target LIMIT and a stop
   * SL-M, opposite side, same quantity, sharing one OCO group.
   */
  private placeBracketLegs(entry: Order, entryPrice: number): void {
    const bracket = entry.bracket!;
    const exitSide: OrderSide = entry.side === "BUY" ? "SELL" : "BUY";
    const ocoGroup = `oco-${entry.id}`;
    const last = this.lastPrices.get(entry.symbol) ?? entryPrice;

    if (isPositive(bracket.targetPrice)) {
      this.placeLeg(entry, {
        side: exitSide,
        type: "LIMIT",
        limitPrice: bracket.targetPrice,
        ocoGroup,
        legType: "target",
      });
    }

    if (isPositive(bracket.stopLossPrice)) {
      // If the market is already at or through the stop, an SL-M would be
      // rejected as a stop placed through the market — the honest equivalent
      // is to exit now, which is what the stop was for.
      const alreadyThrough = exitSide === "SELL" ? last <= bracket.stopLossPrice : last >= bracket.stopLossPrice;
      this.placeLeg(entry, {
        side: exitSide,
        ...(alreadyThrough ? { type: "MARKET" as const } : { type: "SL-M" as const, triggerPrice: bracket.stopLossPrice }),
        ocoGroup,
        legType: "stop-loss",
      });
    }
  }

  private placeLeg(
    entry: Order,
    leg: {
      side: OrderSide;
      type: OrderType;
      limitPrice?: number;
      triggerPrice?: number;
      ocoGroup: string;
      legType: OrderLegType;
    }
  ): Order {
    const timestamp = this.now();
    const order: Order = {
      id: this.idFactory(),
      symbol: entry.symbol,
      side: leg.side,
      type: leg.type,
      product: entry.product,
      quantity: entry.quantity,
      filledQuantity: 0,
      limitPrice: leg.limitPrice,
      triggerPrice: leg.triggerPrice,
      parentOrderId: entry.id,
      ocoGroup: leg.ocoGroup,
      legType: leg.legType,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const rejection = this.validate(order);
    if (rejection) return this.reject(order, rejection);

    this.orders.set(order.id, order);
    this.emit({ type: "order", order });

    const last = this.lastPrices.get(order.symbol);
    if (last !== undefined) this.tryFill(order, last, timestamp);
    return this.orders.get(order.id) ?? order;
  }

  /** Cancel resting bracket legs attached to a position that is now flat. */
  private cancelBracketLegsFor(symbol: string, product: ProductType): void {
    for (const order of [...this.orders.values()]) {
      if (order.symbol !== symbol || order.product !== product) continue;
      if (!order.parentOrderId || !isRestingStatus(order.status)) continue;
      this.cancelOrder(order.id);
    }
  }

  // ---- positions ----

  private applyFillToPosition(fill: Fill): void {
    const key = positionKey(fill.symbol, fill.product);
    const signedQty = fill.side === "BUY" ? fill.quantity : -fill.quantity;
    const existing = this.positions.get(key);

    if (!existing || existing.quantity === 0) {
      this.setPosition(key, {
        symbol: fill.symbol,
        product: fill.product,
        quantity: signedQty,
        averagePrice: fill.price,
        realizedPnl: -fill.charges,
        charges: fill.charges,
        openedAt: fill.timestamp,
        updatedAt: fill.timestamp,
      });
      return;
    }

    if (Math.sign(existing.quantity) === Math.sign(signedQty)) {
      const totalQty = existing.quantity + signedQty;
      this.setPosition(key, {
        ...existing,
        quantity: totalQty,
        averagePrice:
          (Math.abs(existing.quantity) * existing.averagePrice + Math.abs(signedQty) * fill.price) / Math.abs(totalQty),
        realizedPnl: existing.realizedPnl - fill.charges,
        charges: existing.charges + fill.charges,
        updatedAt: fill.timestamp,
      });
      return;
    }

    // Opposite direction: close up to the open quantity, then reverse with the remainder.
    const closedQty = Math.min(Math.abs(existing.quantity), Math.abs(signedQty));
    const remainingQty = Math.abs(signedQty) - closedQty;
    const direction = Math.sign(existing.quantity);
    const grossPnl = (fill.price - existing.averagePrice) * closedQty * direction;
    // Charges split across the closing and (if any) reversing legs by quantity.
    const closeCharges = fill.charges * (closedQty / Math.abs(signedQty));

    this.grossRealizedPnl += grossPnl;

    const trade: Trade = {
      id: this.idFactory(),
      symbol: fill.symbol,
      product: fill.product,
      side: direction > 0 ? "BUY" : "SELL",
      quantity: closedQty,
      entryPrice: existing.averagePrice,
      exitPrice: fill.price,
      pnl: grossPnl - closeCharges,
      charges: closeCharges,
      entryTime: existing.openedAt,
      exitTime: fill.timestamp,
    };
    this.trades.push(trade);
    this.emit({ type: "trade", trade });

    if (remainingQty > 0) {
      this.setPosition(key, {
        symbol: fill.symbol,
        product: fill.product,
        quantity: remainingQty * Math.sign(signedQty),
        averagePrice: fill.price,
        realizedPnl: existing.realizedPnl + grossPnl - fill.charges,
        charges: existing.charges + fill.charges,
        openedAt: fill.timestamp,
        updatedAt: fill.timestamp,
      });
      return;
    }

    const nextQty = existing.quantity + signedQty;
    if (nextQty === 0) {
      this.positions.delete(key);
      this.emit({ type: "position", position: null, symbol: fill.symbol, product: fill.product });
      // Nothing left to protect: a surviving leg would open a fresh position.
      this.cancelBracketLegsFor(fill.symbol, fill.product);
      return;
    }

    this.setPosition(key, {
      ...existing,
      quantity: nextQty,
      realizedPnl: existing.realizedPnl + grossPnl - fill.charges,
      charges: existing.charges + fill.charges,
      updatedAt: fill.timestamp,
    });
  }

  private setPosition(key: string, position: Position): void {
    this.positions.set(key, position);
    this.emit({ type: "position", position, symbol: position.symbol, product: position.product });
  }

  /** Square off one position with a MARKET order in the opposite direction. */
  closePosition(symbol: string, product: ProductType): Order | null {
    const position = this.positions.get(positionKey(symbol, product));
    if (!position || position.quantity === 0) return null;
    return this.placeOrder({
      symbol,
      product,
      side: position.quantity > 0 ? "SELL" : "BUY",
      type: "MARKET",
      quantity: Math.abs(position.quantity),
    });
  }

  /**
   * Square off one product only — what an intraday (MIS) auto-square-off does
   * at the session close, leaving delivery (CNC) holdings untouched.
   */
  squareOffProduct(product: ProductType): void {
    for (const order of [...this.orders.values()]) {
      if (order.product === product && isRestingStatus(order.status)) this.cancelOrder(order.id);
    }
    for (const position of [...this.positions.values()]) {
      if (position.product === product) this.closePosition(position.symbol, position.product);
    }
  }

  /** Cancel every resting order, then square off every open position. */
  squareOffAll(): void {
    for (const order of [...this.orders.values()]) {
      if (isRestingStatus(order.status)) this.cancelOrder(order.id);
    }
    for (const position of [...this.positions.values()]) {
      this.closePosition(position.symbol, position.product);
    }
  }

  // ---- reads ----

  getOrders(): Order[] {
    return [...this.orders.values()].sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
  }

  getOpenOrders(): Order[] {
    return this.getOrders().filter((o) => isRestingStatus(o.status));
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getPositions(): PositionValuation[] {
    return [...this.positions.values()].map((p) => this.valuePosition(p));
  }

  getTrades(): Trade[] {
    return [...this.trades].sort((a, b) => b.exitTime - a.exitTime);
  }

  private valuePosition(position: Position): PositionValuation {
    const lastPrice = this.lastPrices.get(position.symbol) ?? position.averagePrice;
    const unrealizedPnl = (lastPrice - position.averagePrice) * position.quantity;
    const entryValue = Math.abs(position.quantity) * position.averagePrice;
    return {
      ...position,
      lastPrice,
      unrealizedPnl,
      unrealizedPnlPercent: entryValue === 0 ? 0 : (unrealizedPnl / entryValue) * 100,
      value: Math.abs(position.quantity) * lastPrice,
    };
  }

  getAccount(): AccountSnapshot {
    const realizedPnl = this.grossRealizedPnl - this.totalCharges;
    const unrealizedPnl = this.getPositions().reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return {
      startingBalance: this.startingBalance,
      availableBalance: this.availableBalance(),
      usedMargin: this.usedMargin(),
      realizedPnl,
      unrealizedPnl,
      totalCharges: this.totalCharges,
      equity: this.startingBalance + realizedPnl + unrealizedPnl,
    };
  }

  private usedMargin(): number {
    let total = 0;
    for (const p of this.positions.values()) total += Math.abs(p.quantity) * p.averagePrice;
    return total;
  }

  /** Cash not already committed to an open position or a resting order. */
  private availableBalance(): number {
    const cash = this.startingBalance + this.grossRealizedPnl - this.totalCharges;
    let blocked = 0;
    for (const order of this.orders.values()) {
      if (isRestingStatus(order.status)) blocked += this.marginRequiredFor(order);
    }
    return cash - this.usedMargin() - blocked;
  }

  /**
   * Margin an order needs at 1x, counting only the quantity that would
   * *increase* exposure — an exit order against an open position needs none.
   */
  private marginRequiredFor(order: Order): number {
    const position = this.positions.get(positionKey(order.symbol, order.product));
    const openQty = position?.quantity ?? 0;
    const orderSign = order.side === "BUY" ? 1 : -1;
    const reducible = Math.sign(openQty) === -orderSign ? Math.abs(openQty) : 0;
    const increasingQty = Math.max(0, order.quantity - reducible);
    if (increasingQty === 0) return 0;
    const reference = order.limitPrice ?? order.triggerPrice ?? this.lastPrices.get(order.symbol) ?? 0;
    return increasingQty * reference;
  }

  // ---- persistence ----

  /** Plain-object snapshot, so the app can persist the book across reloads. */
  toJSON(): PaperTradingState {
    return {
      version: 1,
      orders: [...this.orders.values()],
      positions: [...this.positions.values()],
      trades: this.trades,
      lastPrices: [...this.lastPrices.entries()],
      grossRealizedPnl: this.grossRealizedPnl,
      totalCharges: this.totalCharges,
    };
  }

  restore(state: PaperTradingState): void {
    if (!state || state.version !== 1) return;
    this.orders = new Map(state.orders.map((o) => [o.id, o]));
    this.positions = new Map(state.positions.map((p) => [positionKey(p.symbol, p.product), p]));
    this.trades = [...state.trades];
    this.lastPrices = new Map(state.lastPrices);
    this.grossRealizedPnl = state.grossRealizedPnl;
    this.totalCharges = state.totalCharges;
  }

  reset(): void {
    this.orders.clear();
    this.positions.clear();
    this.trades = [];
    this.grossRealizedPnl = 0;
    this.totalCharges = 0;
  }
}

export interface PaperTradingState {
  version: 1;
  orders: Order[];
  positions: Position[];
  trades: Trade[];
  lastPrices: [string, number][];
  grossRealizedPnl: number;
  totalCharges: number;
}

function limitFillPrice(side: OrderSide, limitPrice: number, price: number): number | null {
  if (side === "BUY") return price <= limitPrice ? Math.min(limitPrice, price) : null;
  return price >= limitPrice ? Math.max(limitPrice, price) : null;
}

function isRestingStatus(status: Order["status"]): boolean {
  return status === "open" || status === "triggered";
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

import { describe, expect, it } from "vitest";
import { PaperTradingEngine } from "../engine";
import { createSimpleChargesModel } from "../charges";
import { PaperTradingEvent } from "../types";

/** Deterministic engine: fixed clock, sequential ids — no Date.now, no randomness. */
function makeEngine(startingBalance = 1_000_000, charges?: ReturnType<typeof createSimpleChargesModel>) {
  let clock = 1_700_000_000_000;
  let id = 0;
  const engine = new PaperTradingEngine({
    startingBalance,
    charges,
    now: () => (clock += 1000),
    idFactory: () => `id-${++id}`,
  });
  return engine;
}

describe("market orders", () => {
  it("rejects a MARKET order before any price is known", () => {
    const engine = makeEngine();
    const order = engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    expect(order.status).toBe("rejected");
    expect(order.rejectionReason).toContain("No live price");
    expect(engine.getPositions()).toHaveLength(0);
  });

  it("fills at the last price and opens a long position", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    const order = engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });

    expect(order.status).toBe("filled");
    expect(order.averageFillPrice).toBe(2500);
    const [position] = engine.getPositions();
    expect(position).toMatchObject({ symbol: "RELIANCE", product: "MIS", quantity: 10, averagePrice: 2500 });
  });

  it("marks an open position to market", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("RELIANCE", 2530);

    const [position] = engine.getPositions();
    expect(position!.unrealizedPnl).toBeCloseTo(300);
    expect(position!.unrealizedPnlPercent).toBeCloseTo((300 / 25000) * 100);
    expect(engine.getAccount().unrealizedPnl).toBeCloseTo(300);
    // Unrealized P&L is not booked.
    expect(engine.getAccount().realizedPnl).toBe(0);
  });

  it("opens a short position on a SELL with no holding", () => {
    const engine = makeEngine();
    engine.onPrice("TCS", 4000);
    engine.placeOrder({ symbol: "TCS", side: "SELL", type: "MARKET", product: "MIS", quantity: 5 });
    engine.onPrice("TCS", 3950);

    const [position] = engine.getPositions();
    expect(position!.quantity).toBe(-5);
    expect(position!.unrealizedPnl).toBeCloseTo(250);
  });
});

describe("limit orders", () => {
  it("rests until the market trades through the limit, then fills at the limit price", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({
      symbol: "INFY",
      side: "BUY",
      type: "LIMIT",
      product: "CNC",
      quantity: 10,
      limitPrice: 1480,
    });
    expect(order.status).toBe("open");

    engine.onPrice("INFY", 1490);
    expect(engine.getOrder(order.id)!.status).toBe("open");

    engine.onPrice("INFY", 1475);
    const filled = engine.getOrder(order.id)!;
    expect(filled.status).toBe("filled");
    // Conservative: filled at the market price when it is better than the limit.
    expect(filled.averageFillPrice).toBe(1475);
  });

  it("fills immediately when placed already marketable", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({
      symbol: "INFY",
      side: "SELL",
      type: "LIMIT",
      product: "CNC",
      quantity: 10,
      limitPrice: 1490,
    });
    expect(order.status).toBe("filled");
    expect(order.averageFillPrice).toBe(1500);
  });

  it("requires a limit price", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({ symbol: "INFY", side: "BUY", type: "LIMIT", product: "CNC", quantity: 1 });
    expect(order.status).toBe("rejected");
    expect(order.rejectionReason).toBe("Limit price required");
  });
});

describe("stop orders", () => {
  it("rejects a stop that is already through the market", () => {
    const engine = makeEngine();
    engine.onPrice("SBIN", 600);
    const order = engine.placeOrder({
      symbol: "SBIN",
      side: "SELL",
      type: "SL-M",
      product: "MIS",
      quantity: 10,
      triggerPrice: 610,
    });
    expect(order.status).toBe("rejected");
    expect(order.rejectionReason).toContain("below the last price");
  });

  it("fills an SL-M at the triggering price", () => {
    const engine = makeEngine();
    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    const stop = engine.placeOrder({
      symbol: "SBIN",
      side: "SELL",
      type: "SL-M",
      product: "MIS",
      quantity: 10,
      triggerPrice: 590,
    });
    expect(stop.status).toBe("open");

    engine.onPrice("SBIN", 588);
    const filled = engine.getOrder(stop.id)!;
    expect(filled.status).toBe("filled");
    expect(filled.averageFillPrice).toBe(588);
    expect(engine.getPositions()).toHaveLength(0);
    expect(engine.getAccount().realizedPnl).toBeCloseTo(-120);
  });

  it("turns an SL into a resting limit that only fills at its limit or better", () => {
    const engine = makeEngine();
    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    const stop = engine.placeOrder({
      symbol: "SBIN",
      side: "SELL",
      type: "SL",
      product: "MIS",
      quantity: 10,
      triggerPrice: 590,
      limitPrice: 589,
    });

    // Gaps straight through both the trigger and the limit: triggered, not filled.
    engine.onPrice("SBIN", 585);
    expect(engine.getOrder(stop.id)!.status).toBe("triggered");

    engine.onPrice("SBIN", 592);
    expect(engine.getOrder(stop.id)!.status).toBe("filled");
    expect(engine.getOrder(stop.id)!.averageFillPrice).toBe(592);
  });
});

describe("position netting", () => {
  it("averages up when adding to a long", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("RELIANCE", 2600);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });

    const [position] = engine.getPositions();
    expect(position!.quantity).toBe(20);
    expect(position!.averagePrice).toBeCloseTo(2550);
    expect(engine.getTrades()).toHaveLength(0);
  });

  it("books a trade on a partial exit and keeps the rest open", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("RELIANCE", 2550);
    engine.placeOrder({ symbol: "RELIANCE", side: "SELL", type: "MARKET", product: "MIS", quantity: 4 });

    const [position] = engine.getPositions();
    expect(position!.quantity).toBe(6);
    expect(position!.averagePrice).toBe(2500);

    const [trade] = engine.getTrades();
    expect(trade).toMatchObject({ side: "BUY", quantity: 4, entryPrice: 2500, exitPrice: 2550 });
    expect(trade!.pnl).toBeCloseTo(200);
    expect(engine.getAccount().realizedPnl).toBeCloseTo(200);
    expect(engine.getAccount().unrealizedPnl).toBeCloseTo(300);
  });

  it("closes and reverses when the exit quantity exceeds the open quantity", () => {
    const engine = makeEngine();
    engine.onPrice("TCS", 4000);
    engine.placeOrder({ symbol: "TCS", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("TCS", 4100);
    engine.placeOrder({ symbol: "TCS", side: "SELL", type: "MARKET", product: "MIS", quantity: 15 });

    const [position] = engine.getPositions();
    expect(position!.quantity).toBe(-5);
    expect(position!.averagePrice).toBe(4100);

    const [trade] = engine.getTrades();
    expect(trade!.quantity).toBe(10);
    expect(trade!.pnl).toBeCloseTo(1000);
    expect(engine.getAccount().realizedPnl).toBeCloseTo(1000);
  });

  it("keeps MIS and CNC positions in the same symbol separate", () => {
    const engine = makeEngine();
    engine.onPrice("HDFCBANK", 1600);
    engine.placeOrder({ symbol: "HDFCBANK", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.placeOrder({ symbol: "HDFCBANK", side: "BUY", type: "MARKET", product: "CNC", quantity: 5 });

    const positions = engine.getPositions();
    expect(positions).toHaveLength(2);
    expect(positions.map((p) => p.product).sort()).toEqual(["CNC", "MIS"]);
  });

  it("realizes a short profit when buying back lower", () => {
    const engine = makeEngine();
    engine.onPrice("ICICIBANK", 1000);
    engine.placeOrder({ symbol: "ICICIBANK", side: "SELL", type: "MARKET", product: "MIS", quantity: 20 });
    engine.onPrice("ICICIBANK", 980);
    engine.closePosition("ICICIBANK", "MIS");

    const [trade] = engine.getTrades();
    expect(trade).toMatchObject({ side: "SELL", quantity: 20, entryPrice: 1000, exitPrice: 980 });
    expect(trade!.pnl).toBeCloseTo(400);
    expect(engine.getPositions()).toHaveLength(0);
  });
});

describe("funds", () => {
  it("blocks margin for open positions and resting orders, and rejects what it cannot fund", () => {
    const engine = makeEngine(100_000);
    engine.onPrice("RELIANCE", 2500);

    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "CNC", quantity: 20 });
    expect(engine.getAccount().usedMargin).toBeCloseTo(50_000);
    expect(engine.getAccount().availableBalance).toBeCloseTo(50_000);

    const resting = engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "LIMIT",
      product: "CNC",
      quantity: 10,
      limitPrice: 2400,
    });
    expect(resting.status).toBe("open");
    expect(engine.getAccount().availableBalance).toBeCloseTo(26_000);

    const tooBig = engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "CNC", quantity: 20 });
    expect(tooBig.status).toBe("rejected");
    expect(tooBig.rejectionReason).toBe("Insufficient funds");
  });

  it("does not block margin for an order that only reduces an open position", () => {
    const engine = makeEngine(100_000);
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "CNC", quantity: 40 });
    expect(engine.getAccount().availableBalance).toBeCloseTo(0);

    const exit = engine.placeOrder({
      symbol: "RELIANCE",
      side: "SELL",
      type: "LIMIT",
      product: "CNC",
      quantity: 40,
      limitPrice: 2600,
    });
    expect(exit.status).toBe("open");
  });

  it("equity tracks realized plus unrealized P&L", () => {
    const engine = makeEngine(100_000);
    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("SBIN", 650);
    engine.placeOrder({ symbol: "SBIN", side: "SELL", type: "MARKET", product: "MIS", quantity: 5 });
    engine.onPrice("SBIN", 700);

    const account = engine.getAccount();
    expect(account.realizedPnl).toBeCloseTo(250);
    expect(account.unrealizedPnl).toBeCloseTo(500);
    expect(account.equity).toBeCloseTo(100_000 + 250 + 500);
  });
});

describe("charges", () => {
  it("deducts configured charges from realized P&L and equity", () => {
    const charges = createSimpleChargesModel({ perOrder: 20 });
    const engine = makeEngine(100_000, charges);
    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.placeOrder({ symbol: "SBIN", side: "SELL", type: "MARKET", product: "MIS", quantity: 10 });

    const account = engine.getAccount();
    expect(account.totalCharges).toBeCloseTo(40);
    expect(account.realizedPnl).toBeCloseTo(-40);
    expect(account.equity).toBeCloseTo(100_000 - 40);
    expect(engine.getTrades()[0]!.pnl).toBeCloseTo(-20);
  });

  it("caps a percentage model at its per-order maximum", () => {
    const charges = createSimpleChargesModel({ percentOfTurnover: 0.03, maxPerOrder: 20 });
    expect(charges({ orderId: "x", symbol: "S", side: "BUY", product: "MIS", quantity: 1, price: 1000, timestamp: 0 })).toBeCloseTo(0.3);
    expect(charges({ orderId: "x", symbol: "S", side: "BUY", product: "MIS", quantity: 1000, price: 1000, timestamp: 0 })).toBe(20);
  });
});

describe("order lifecycle", () => {
  it("cancels a resting order and frees its margin", () => {
    const engine = makeEngine(100_000);
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({
      symbol: "INFY",
      side: "BUY",
      type: "LIMIT",
      product: "CNC",
      quantity: 10,
      limitPrice: 1400,
    });
    expect(engine.getAccount().availableBalance).toBeCloseTo(86_000);

    engine.cancelOrder(order.id);
    expect(engine.getOrder(order.id)!.status).toBe("cancelled");
    expect(engine.getAccount().availableBalance).toBeCloseTo(100_000);
    expect(engine.getOpenOrders()).toHaveLength(0);

    // A cancelled order never fills afterwards.
    engine.onPrice("INFY", 1300);
    expect(engine.getPositions()).toHaveLength(0);
  });

  it("modifies a resting limit and fills it at the new price", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({
      symbol: "INFY",
      side: "BUY",
      type: "LIMIT",
      product: "CNC",
      quantity: 10,
      limitPrice: 1400,
    });

    engine.modifyOrder(order.id, { limitPrice: 1495, quantity: 5 });
    engine.onPrice("INFY", 1494);

    const filled = engine.getOrder(order.id)!;
    expect(filled.status).toBe("filled");
    expect(filled.quantity).toBe(5);
    expect(engine.getPositions()[0]!.quantity).toBe(5);
  });

  it("will not cancel or modify an order that already filled", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const order = engine.placeOrder({ symbol: "INFY", side: "BUY", type: "MARKET", product: "CNC", quantity: 1 });
    expect(engine.cancelOrder(order.id)).toBeNull();
    expect(engine.modifyOrder(order.id, { quantity: 5 })).toBeNull();
  });

  it("squares off every position and cancels every resting order", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.onPrice("TCS", 4000);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.placeOrder({ symbol: "TCS", side: "SELL", type: "MARKET", product: "MIS", quantity: 5 });
    engine.placeOrder({ symbol: "TCS", side: "BUY", type: "LIMIT", product: "MIS", quantity: 5, limitPrice: 3000 });

    engine.squareOffAll();

    expect(engine.getPositions()).toHaveLength(0);
    expect(engine.getOpenOrders()).toHaveLength(0);
    expect(engine.getTrades()).toHaveLength(2);
  });

  it("rejects a non-integer or non-positive quantity", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    expect(engine.placeOrder({ symbol: "INFY", side: "BUY", type: "MARKET", product: "CNC", quantity: 0 }).status).toBe("rejected");
    expect(engine.placeOrder({ symbol: "INFY", side: "BUY", type: "MARKET", product: "CNC", quantity: 1.5 }).status).toBe("rejected");
  });
});

describe("events", () => {
  it("emits order, fill, position and trade events in order", () => {
    const engine = makeEngine();
    const seen: PaperTradingEvent["type"][] = [];
    engine.subscribe((e) => {
      if (e.type !== "price") seen.push(e.type);
    });

    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("SBIN", 620);
    engine.closePosition("SBIN", "MIS");

    expect(seen).toEqual([
      "order", // accepted
      "position", // opened
      "order", // filled
      "fill",
      "order", // exit accepted
      "trade",
      "position", // closed -> null
      "order", // exit filled
      "fill",
    ]);
  });

  it("stops delivering events after unsubscribe", () => {
    const engine = makeEngine();
    let count = 0;
    const off = engine.subscribe(() => count++);
    engine.onPrice("SBIN", 600);
    const afterFirst = count;
    off();
    engine.onPrice("SBIN", 601);
    expect(count).toBe(afterFirst);
  });
});

describe("persistence", () => {
  it("round-trips the whole book through JSON", () => {
    const engine = makeEngine(250_000);
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.onPrice("RELIANCE", 2550);
    engine.placeOrder({ symbol: "RELIANCE", side: "SELL", type: "MARKET", product: "MIS", quantity: 4 });
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "LIMIT", product: "MIS", quantity: 5, limitPrice: 2400 });

    const serialized = JSON.parse(JSON.stringify(engine.toJSON()));
    const restored = makeEngine(250_000);
    restored.restore(serialized);

    expect(restored.getPositions()).toEqual(engine.getPositions());
    expect(restored.getTrades()).toEqual(engine.getTrades());
    expect(restored.getOpenOrders()).toEqual(engine.getOpenOrders());
    expect(restored.getAccount()).toEqual(engine.getAccount());

    // The restored book keeps matching where the original left off.
    restored.onPrice("RELIANCE", 2390);
    expect(restored.getPositions()[0]!.quantity).toBe(11);
  });

  it("ignores a snapshot from an unknown version", () => {
    const engine = makeEngine();
    engine.onPrice("SBIN", 600);
    engine.placeOrder({ symbol: "SBIN", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.restore({ ...engine.toJSON(), version: 2 as unknown as 1 });
    expect(engine.getPositions()).toHaveLength(1);
  });
});

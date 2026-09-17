import { describe, expect, it } from "vitest";
import { PaperTradingEngine } from "../engine";
import { istDayKey, istMinutesOfDay, isTradingWeekday, shouldSquareOffIntraday, SESSION_CLOSE_IST_MINUTES } from "../session";

function makeEngine(startingBalance = 1_000_000) {
  let clock = 1_700_000_000_000;
  let id = 0;
  return new PaperTradingEngine({
    startingBalance,
    now: () => (clock += 1000),
    idFactory: () => `id-${++id}`,
  });
}

describe("bracket orders", () => {
  it("places a target and a stop once the entry fills", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    const entry = engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    expect(entry.status).toBe("filled");
    const legs = engine.getOpenOrders();
    expect(legs).toHaveLength(2);
    expect(legs.every((l) => l.parentOrderId === entry.id && l.side === "SELL" && l.quantity === 10)).toBe(true);

    const target = legs.find((l) => l.legType === "target")!;
    const stop = legs.find((l) => l.legType === "stop-loss")!;
    expect(target).toMatchObject({ type: "LIMIT", limitPrice: 2550 });
    expect(stop).toMatchObject({ type: "SL-M", triggerPrice: 2480 });
    expect(target.ocoGroup).toBe(stop.ocoGroup);
  });

  it("cancels the stop when the target fills, and leaves the position flat", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    engine.onPrice("RELIANCE", 2560);

    expect(engine.getPositions()).toHaveLength(0);
    expect(engine.getOpenOrders()).toHaveLength(0);
    const orders = engine.getOrders();
    expect(orders.find((o) => o.legType === "target")!.status).toBe("filled");
    expect(orders.find((o) => o.legType === "stop-loss")!.status).toBe("cancelled");
    expect(engine.getAccount().realizedPnl).toBeCloseTo(600);
  });

  it("cancels the target when the stop fires", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    engine.onPrice("RELIANCE", 2475);

    expect(engine.getPositions()).toHaveLength(0);
    expect(engine.getOpenOrders()).toHaveLength(0);
    const orders = engine.getOrders();
    expect(orders.find((o) => o.legType === "stop-loss")!.status).toBe("filled");
    expect(orders.find((o) => o.legType === "target")!.status).toBe("cancelled");
    expect(engine.getAccount().realizedPnl).toBeCloseTo(-250);
  });

  it("brackets a short with the stop above and the target below", () => {
    const engine = makeEngine();
    engine.onPrice("TCS", 4000);
    engine.placeOrder({
      symbol: "TCS",
      side: "SELL",
      type: "MARKET",
      product: "MIS",
      quantity: 5,
      bracket: { stopLossPrice: 4050, targetPrice: 3900 },
    });

    const legs = engine.getOpenOrders();
    expect(legs.every((l) => l.side === "BUY")).toBe(true);
    expect(legs.find((l) => l.legType === "stop-loss")).toMatchObject({ type: "SL-M", triggerPrice: 4050 });

    engine.onPrice("TCS", 3890);
    expect(engine.getPositions()).toHaveLength(0);
    // Filled at 3890, not at the 3900 limit: the market traded through it.
    expect(engine.getAccount().realizedPnl).toBeCloseTo((4000 - 3890) * 5);
  });

  it("attaches the legs only after a resting entry actually fills", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    const entry = engine.placeOrder({
      symbol: "INFY",
      side: "BUY",
      type: "LIMIT",
      product: "MIS",
      quantity: 10,
      limitPrice: 1450,
      bracket: { stopLossPrice: 1430, targetPrice: 1500 },
    });
    expect(entry.status).toBe("open");
    expect(engine.getOpenOrders()).toHaveLength(1);

    engine.onPrice("INFY", 1445);
    expect(engine.getOrder(entry.id)!.status).toBe("filled");
    expect(engine.getOpenOrders().filter((o) => o.parentOrderId === entry.id)).toHaveLength(2);
  });

  it("exits at market when the entry fills already through its stop", () => {
    const engine = makeEngine();
    engine.onPrice("SBIN", 600);
    // A limit entry placed above the market fills immediately at 600, which is
    // already below the 610 stop the bracket asked for.
    engine.placeOrder({
      symbol: "SBIN",
      side: "BUY",
      type: "LIMIT",
      product: "MIS",
      quantity: 10,
      limitPrice: 620,
      bracket: { stopLossPrice: 610, targetPrice: 640 },
    });

    const stop = engine.getOrders().find((o) => o.legType === "stop-loss")!;
    expect(stop.type).toBe("MARKET");
    expect(stop.status).toBe("filled");
    expect(engine.getPositions()).toHaveLength(0);
    // The target must not survive its sibling.
    expect(engine.getOrders().find((o) => o.legType === "target")!.status).toBe("cancelled");
  });

  it("cancels the whole bracket when one leg is cancelled by hand", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    const target = engine.getOpenOrders().find((o) => o.legType === "target")!;
    engine.cancelOrder(target.id);

    expect(engine.getOpenOrders()).toHaveLength(0);
    expect(engine.getPositions()).toHaveLength(1);
  });

  it("drops the legs when the position is closed some other way", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    engine.closePosition("RELIANCE", "MIS");

    expect(engine.getPositions()).toHaveLength(0);
    // Were a leg left resting, the next tick through it would open a new short.
    expect(engine.getOpenOrders()).toHaveLength(0);
    engine.onPrice("RELIANCE", 2560);
    expect(engine.getPositions()).toHaveLength(0);
  });

  it("rejects a bracket whose legs are on the wrong side of the entry", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);

    const stopAbove = engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 1,
      bracket: { stopLossPrice: 2520 },
    });
    expect(stopAbove.status).toBe("rejected");
    expect(stopAbove.rejectionReason).toContain("Stop-loss must be below");

    const targetBelow = engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 1,
      bracket: { targetPrice: 2480 },
    });
    expect(targetBelow.status).toBe("rejected");
    expect(targetBelow.rejectionReason).toContain("Target must be above");

    const emptyBracket = engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 1,
      bracket: {},
    });
    expect(emptyBracket.status).toBe("rejected");

    // None of the rejections left an order or a position behind.
    expect(engine.getOpenOrders()).toHaveLength(0);
    expect(engine.getPositions()).toHaveLength(0);
  });

  it("survives a JSON round-trip with its legs still linked", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.placeOrder({
      symbol: "RELIANCE",
      side: "BUY",
      type: "MARKET",
      product: "MIS",
      quantity: 10,
      bracket: { stopLossPrice: 2480, targetPrice: 2550 },
    });

    const restored = makeEngine();
    restored.restore(JSON.parse(JSON.stringify(engine.toJSON())));

    restored.onPrice("RELIANCE", 2560);
    expect(restored.getPositions()).toHaveLength(0);
    expect(restored.getOpenOrders()).toHaveLength(0);
  });
});

describe("intraday square-off", () => {
  it("closes MIS positions and leaves CNC holdings alone", () => {
    const engine = makeEngine();
    engine.onPrice("RELIANCE", 2500);
    engine.onPrice("INFY", 1500);
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "MARKET", product: "MIS", quantity: 10 });
    engine.placeOrder({ symbol: "INFY", side: "BUY", type: "MARKET", product: "CNC", quantity: 5 });
    engine.placeOrder({ symbol: "RELIANCE", side: "BUY", type: "LIMIT", product: "MIS", quantity: 5, limitPrice: 2400 });
    engine.placeOrder({ symbol: "INFY", side: "BUY", type: "LIMIT", product: "CNC", quantity: 5, limitPrice: 1400 });

    engine.squareOffProduct("MIS");

    const positions = engine.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ symbol: "INFY", product: "CNC", quantity: 5 });

    const open = engine.getOpenOrders();
    expect(open).toHaveLength(1);
    expect(open[0]!.product).toBe("CNC");
  });

  it("is a no-op when nothing intraday is open", () => {
    const engine = makeEngine();
    engine.onPrice("INFY", 1500);
    engine.placeOrder({ symbol: "INFY", side: "BUY", type: "MARKET", product: "CNC", quantity: 5 });
    const before = engine.getAccount();

    engine.squareOffProduct("MIS");

    expect(engine.getPositions()).toHaveLength(1);
    expect(engine.getAccount().realizedPnl).toBe(before.realizedPnl);
  });
});

describe("session arithmetic", () => {
  // 2026-09-17 is a Thursday. 09:45 IST = 04:15 UTC.
  const thursday0945Ist = Date.UTC(2026, 8, 17, 4, 15);
  const thursday1531Ist = Date.UTC(2026, 8, 17, 10, 1);
  const saturday1600Ist = Date.UTC(2026, 8, 19, 10, 30);

  it("reads IST minute-of-day independently of the machine timezone", () => {
    expect(istMinutesOfDay(thursday0945Ist)).toBe(9 * 60 + 45);
    expect(istMinutesOfDay(thursday1531Ist)).toBe(15 * 60 + 31);
  });

  it("rolls the IST day key at IST midnight, not UTC midnight", () => {
    // 20:00 UTC on the 17th is already 01:30 IST on the 18th.
    expect(istDayKey(Date.UTC(2026, 8, 17, 20, 0))).toBe("2026-09-18");
    expect(istDayKey(thursday0945Ist)).toBe("2026-09-17");
  });

  it("knows weekends are not trading days", () => {
    expect(isTradingWeekday(thursday0945Ist)).toBe(true);
    expect(isTradingWeekday(saturday1600Ist)).toBe(false);
  });

  it("fires once, after the close, on a trading day only", () => {
    expect(shouldSquareOffIntraday({ now: thursday0945Ist })).toBe(false);
    expect(shouldSquareOffIntraday({ now: thursday1531Ist })).toBe(true);
    expect(shouldSquareOffIntraday({ now: saturday1600Ist })).toBe(false);

    // Already run today.
    expect(shouldSquareOffIntraday({ now: thursday1531Ist, lastRunDayKey: "2026-09-17" })).toBe(false);
    // Ran yesterday: today still needs one.
    expect(shouldSquareOffIntraday({ now: thursday1531Ist, lastRunDayKey: "2026-09-16" })).toBe(true);
  });

  it("honours a broker cut-off earlier than the exchange close", () => {
    const thursday1521Ist = Date.UTC(2026, 8, 17, 9, 51);
    expect(shouldSquareOffIntraday({ now: thursday1521Ist })).toBe(false);
    expect(shouldSquareOffIntraday({ now: thursday1521Ist, atIstMinutes: 15 * 60 + 20 })).toBe(true);
    expect(SESSION_CLOSE_IST_MINUTES).toBe(15 * 60 + 30);
  });
});

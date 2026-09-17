import { describe, expect, it } from "vitest";
import { findDraggablePriceLine } from "../render/overlay/priceLineHitTest";
import { PriceLine } from "../render/overlay/OverlayRenderer";

/** 1 rupee = 1 pixel, price 100 at y=0, descending like a real price axis. */
const priceToY = (price: number) => 100 - price;

function line(id: string, price: number, draggable: boolean): PriceLine {
  return { id, price, color: "#fff", label: id, draggable };
}

describe("findDraggablePriceLine", () => {
  const lines = [line("order-a", 60, true), line("position", 50, false), line("order-b", 40, true)];

  it("grabs a draggable line under the pointer", () => {
    expect(findDraggablePriceLine(lines, priceToY(60), priceToY, 5)?.id).toBe("order-a");
    expect(findDraggablePriceLine(lines, priceToY(40) + 3, priceToY, 5)?.id).toBe("order-b");
  });

  it("ignores lines that are not draggable, even directly under the pointer", () => {
    expect(findDraggablePriceLine(lines, priceToY(50), priceToY, 5)).toBeNull();
  });

  it("returns nothing outside the grab distance", () => {
    expect(findDraggablePriceLine(lines, priceToY(60) + 6, priceToY, 5)).toBeNull();
    expect(findDraggablePriceLine(lines, priceToY(60) + 5, priceToY, 5)?.id).toBe("order-a");
  });

  it("takes the closest line when two overlap", () => {
    const overlapping = [line("far", 60, true), line("near", 55, true)];
    // y sits 1px from "near" and 4px from "far".
    expect(findDraggablePriceLine(overlapping, priceToY(56), priceToY, 5)?.id).toBe("near");
  });

  it("is stable on an exact tie, so a repeated grab picks the same line", () => {
    const tied = [line("first", 60, true), line("second", 60, true)];
    const y = priceToY(60);
    expect(findDraggablePriceLine(tied, y, priceToY, 5)?.id).toBe("first");
    expect(findDraggablePriceLine(tied, y, priceToY, 5)?.id).toBe("first");
  });

  it("handles an empty list", () => {
    expect(findDraggablePriceLine([], 10, priceToY, 5)).toBeNull();
  });
});

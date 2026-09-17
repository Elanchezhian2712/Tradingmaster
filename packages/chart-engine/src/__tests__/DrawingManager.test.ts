import { describe, expect, it } from "vitest";
import { DrawingManager } from "../drawings/DrawingManager";
import { Viewport } from "../viewport/Viewport";

function makeViewport(): Viewport {
  const vp = new Viewport();
  vp.setPaneSpecs([{ id: "main", weight: 1, minHeight: 100 }]);
  vp.setContainerSize(800, 400);
  vp.setDataLength(200);
  vp.setPaneRange("main", { min: 0, max: 200 });
  return vp;
}

describe("DrawingManager", () => {
  it("adds, lists, updates and removes drawings", () => {
    const dm = new DrawingManager();
    const obj = dm.add("horizontal-line", [{ index: 10, price: 100 }], "#ff0000");
    expect(dm.list()).toHaveLength(1);

    dm.update(obj.id, { color: "#00ff00" });
    expect(dm.list()[0]!.color).toBe("#00ff00");

    dm.remove(obj.id);
    expect(dm.list()).toHaveLength(0);
  });

  it("findNearest locates a drawing within pixel tolerance and ignores far clicks", () => {
    const dm = new DrawingManager();
    const vp = makeViewport();
    const obj = dm.add("trend-line", [
      { index: 10, price: 100 },
      { index: 50, price: 150 },
    ], "#fff");

    const midX = vp.indexToX(30) + vp.getCandleWidth() / 2;
    const midY = vp.priceToY(125, "main");
    expect(dm.findNearest(midX, midY, vp)).toBe(obj.id);
    expect(dm.findNearest(midX, midY + 500, vp)).toBeNull();
  });
});

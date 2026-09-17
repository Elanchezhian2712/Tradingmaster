import { describe, expect, it } from "vitest";
import { Viewport, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH } from "../viewport/Viewport";

function makeViewport(width = 800, height = 500, dataLength = 1000): Viewport {
  const vp = new Viewport();
  vp.setPaneSpecs([
    { id: "main", weight: 3, minHeight: 100 },
    { id: "volume", weight: 1, minHeight: 50 },
  ]);
  vp.setContainerSize(width, height);
  vp.setDataLength(dataLength);
  return vp;
}

describe("Viewport index/pixel round-trip", () => {
  it("indexToX and xToIndex are inverses", () => {
    const vp = makeViewport();
    for (const idx of [0, 10.5, 500, 999]) {
      const x = vp.indexToX(idx);
      expect(vp.xToIndex(x)).toBeCloseTo(idx, 6);
    }
  });

  it("zoomAtPixel keeps the index under the cursor fixed", () => {
    const vp = makeViewport();
    const pixelX = 300;
    const idxBefore = vp.xToIndex(pixelX);
    vp.zoomAtPixel(pixelX, 1.5);
    const idxAfter = vp.xToIndex(pixelX);
    expect(idxAfter).toBeCloseTo(idxBefore, 4);
  });

  it("clamps candle width within [MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH]", () => {
    const vp = makeViewport();
    for (let i = 0; i < 200; i++) vp.zoomAtPixel(300, 1.5);
    expect(vp.getCandleWidth()).toBeLessThanOrEqual(MAX_CANDLE_WIDTH);
    for (let i = 0; i < 200; i++) vp.zoomAtPixel(300, 1 / 1.5);
    expect(vp.getCandleWidth()).toBeGreaterThanOrEqual(MIN_CANDLE_WIDTH);
  });

  it("panByPixels shifts the visible range by the matching number of indices", () => {
    const vp = makeViewport();
    const before = vp.visibleIndexRange();
    vp.panByPixels(-vp.getCandleWidth() * 10);
    const after = vp.visibleIndexRange();
    expect(after.start).toBeCloseTo(before.start + 10, 4);
  });

  it("preserves the user's zoom level across a timeframe/symbol switch instead of resetting it", () => {
    const vp = makeViewport();
    const defaultWidth = vp.getCandleWidth();
    vp.zoomAtPixel(300, 3); // zoom in well past the default view
    const zoomedWidth = vp.getCandleWidth();
    expect(zoomedWidth).toBeGreaterThan(defaultWidth); // sanity: the zoom actually took effect

    // Loading a new dataset for an already-initialized chart (e.g. switching 5m -> 30m)
    // must not silently reset the zoom back to the default view.
    vp.setDataLength(2000);
    expect(vp.getCandleWidth()).toBeCloseTo(zoomedWidth, 6);
  });

  it("still applies a sensible default zoom on the very first data load", () => {
    const vp = new Viewport();
    vp.setPaneSpecs([{ id: "main", weight: 1, minHeight: 100 }]);
    vp.setContainerSize(800, 500);
    expect(vp.getDataLength()).toBe(0);
    vp.setDataLength(5000);
    const { start, end } = vp.visibleIndexRange();
    expect(end - start).toBeCloseTo(150, 0); // DEFAULT_VISIBLE_CANDLES
  });
});

describe("Viewport price scale", () => {
  it("priceToY and yToPrice are inverses on the main pane", () => {
    const vp = makeViewport();
    vp.setPaneRange("main", { min: 100, max: 200 });
    for (const price of [100, 150, 199]) {
      const y = vp.priceToY(price, "main");
      expect(vp.yToPrice(y, "main")).toBeCloseTo(price, 4);
    }
  });

  it("log scale preserves monotonicity", () => {
    const vp = makeViewport();
    vp.setScaleMode("log");
    vp.setPaneRange("main", { min: 10, max: 1000 });
    const y1 = vp.priceToY(10, "main");
    const y2 = vp.priceToY(100, "main");
    const y3 = vp.priceToY(1000, "main");
    expect(y1).toBeGreaterThan(y2);
    expect(y2).toBeGreaterThan(y3);
  });
});

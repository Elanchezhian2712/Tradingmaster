import { describe, expect, it } from "vitest";
import { computePaneLayout } from "../viewport/PaneLayout";

describe("computePaneLayout", () => {
  it("splits height proportionally to weight above the minimum", () => {
    const rects = computePaneLayout(400, [
      { id: "main", weight: 3, minHeight: 50 },
      { id: "volume", weight: 1, minHeight: 50 },
    ]);
    expect(rects).toHaveLength(2);
    expect(rects[0]!.top).toBe(0);
    expect(rects[1]!.top).toBeCloseTo(rects[0]!.height, 6);
    expect(rects[0]!.height + rects[1]!.height).toBeCloseTo(400, 6);
    expect(rects[0]!.height).toBeGreaterThan(rects[1]!.height);
  });

  it("falls back to the sum of minimums when the container is too small", () => {
    const rects = computePaneLayout(50, [
      { id: "main", weight: 3, minHeight: 100 },
      { id: "volume", weight: 1, minHeight: 50 },
    ]);
    expect(rects[0]!.height).toBe(100);
    expect(rects[1]!.height).toBe(50);
  });
});

import { PriceLine } from "./OverlayRenderer";

/**
 * The draggable price line nearest to `y`, within `maxDistancePx`.
 *
 * Pure so it can be tested without a DOM or a WebGL context: the caller passes
 * a price->pixel function rather than a viewport. When two lines overlap (a
 * stop and a target dragged onto each other, say) the closest one wins, and
 * ties go to the first in the list so repeated grabs stay predictable.
 */
export function findDraggablePriceLine(
  lines: readonly PriceLine[],
  y: number,
  priceToY: (price: number) => number,
  maxDistancePx: number
): PriceLine | null {
  let closest: PriceLine | null = null;
  let closestDistance = maxDistancePx;

  for (const line of lines) {
    if (!line.draggable) continue;
    const distance = Math.abs(priceToY(line.price) - y);
    if (distance < closestDistance || (closest === null && distance <= closestDistance)) {
      closest = line;
      closestDistance = distance;
    }
  }
  return closest;
}

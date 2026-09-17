export type ScaleMode = "linear" | "log" | "percentage";

/** Maps a raw price into "scale space" — a linear axis for whichever mode is active. */
export function toScaleSpace(price: number, mode: ScaleMode, basePrice: number): number {
  switch (mode) {
    case "log":
      return Math.log(Math.max(price, 1e-9));
    case "percentage":
      return basePrice > 0 ? (price / basePrice - 1) * 100 : 0;
    default:
      return price;
  }
}

export function fromScaleSpace(value: number, mode: ScaleMode, basePrice: number): number {
  switch (mode) {
    case "log":
      return Math.exp(value);
    case "percentage":
      return basePrice * (1 + value / 100);
    default:
      return value;
  }
}

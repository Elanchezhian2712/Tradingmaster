import { ChargesModel } from "./types";

export interface SimpleChargesConfig {
  /** Flat fee per executed order. */
  perOrder?: number;
  /** Percentage of turnover (quantity x price), e.g. 0.03 for 0.03%. */
  percentOfTurnover?: number;
  /** Upper bound on the per-order fee, as most Indian brokers cap it. */
  maxPerOrder?: number;
}

/**
 * A turnover-plus-flat-fee charges model.
 *
 * Every rate is supplied by the caller and defaults to zero: real brokerage,
 * STT, exchange transaction, SEBI, stamp duty and GST rates differ per broker,
 * segment and state, so none are hardcoded here. Feed it your own broker's
 * published numbers if you want the P&L to be net of costs.
 */
export function createSimpleChargesModel(config: SimpleChargesConfig = {}): ChargesModel {
  const perOrder = config.perOrder ?? 0;
  const percentOfTurnover = config.percentOfTurnover ?? 0;
  const maxPerOrder = config.maxPerOrder ?? Number.POSITIVE_INFINITY;

  return (fill) => {
    const turnover = fill.quantity * fill.price;
    const fee = perOrder + (turnover * percentOfTurnover) / 100;
    return Math.min(fee, maxPerOrder);
  };
}

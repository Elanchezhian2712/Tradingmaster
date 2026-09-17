/**
 * NSE cash-market session arithmetic, in IST, with no dependency on the
 * machine's timezone — a user in another timezone (or a CI box on UTC) must
 * get the same answer as one in India.
 */

const IST_OFFSET_MINUTES = 330;
const MINUTES_PER_DAY = 1440;

/** NSE cash-market session close: 15:30 IST, as minutes from midnight IST. */
export const SESSION_CLOSE_IST_MINUTES = 15 * 60 + 30;

/** Minutes since midnight IST for an epoch-milliseconds instant. */
export function istMinutesOfDay(epochMs: number): number {
  const utcMinutes = Math.floor(epochMs / 60_000);
  return ((utcMinutes + IST_OFFSET_MINUTES) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** `YYYY-MM-DD` of the IST calendar day, used to run a daily action exactly once. */
export function istDayKey(epochMs: number): string {
  const shifted = new Date(epochMs + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Monday-Friday in IST. Exchange holidays are not modelled — there is no holiday calendar here to be wrong about. */
export function isTradingWeekday(epochMs: number): boolean {
  const day = new Date(epochMs + IST_OFFSET_MINUTES * 60_000).getUTCDay();
  return day >= 1 && day <= 5;
}

export interface SquareOffCheck {
  /** Epoch ms of the instant being tested. */
  now: number;
  /** IST minute-of-day to square off at. Defaults to the session close. */
  atIstMinutes?: number;
  /** IST day key of the last square-off, so it runs once per day. */
  lastRunDayKey?: string | null;
}

/**
 * Whether intraday positions should be squared off right now: a trading
 * weekday, at or past the cut-off, and not already done today.
 */
export function shouldSquareOffIntraday(check: SquareOffCheck): boolean {
  const { now, atIstMinutes = SESSION_CLOSE_IST_MINUTES, lastRunDayKey = null } = check;
  if (!isTradingWeekday(now)) return false;
  if (istMinutesOfDay(now) < atIstMinutes) return false;
  return lastRunDayKey !== istDayKey(now);
}

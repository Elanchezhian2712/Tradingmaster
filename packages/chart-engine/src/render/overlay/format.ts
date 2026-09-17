export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return "";
  const abs = Math.abs(price);
  const decimals = abs >= 1000 ? 1 : abs >= 10 ? 2 : 3;
  return price.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatVolume(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

/** Fixed IST (UTC+5:30) shift so displayed exchange time never depends on the viewer's OS timezone. */
const IST_OFFSET_SEC = 5.5 * 3600;

export function formatTimeForTimeframe(unixSeconds: number, timeframe: string): string {
  const d = new Date((unixSeconds + IST_OFFSET_SEC) * 1000);
  const intraday = ["1m", "3m", "5m", "15m", "30m", "1H", "4H"].includes(timeframe);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (intraday) {
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (timeframe === "1D" || timeframe === "1W") {
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  }
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTimeFull(unixSeconds: number): string {
  const d = new Date((unixSeconds + IST_OFFSET_SEC) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
}

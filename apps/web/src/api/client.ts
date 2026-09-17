import { Order, PaperTradingState, Position, Trade } from "@trading-master/paper-trading";

/**
 * Thin fetch wrapper for the TradingMaster API. Deliberately has no retry or
 * caching: the paper book is pushed on a timer and the next push carries
 * whatever the last one missed, so a failed request costs nothing.
 */
const BASE_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) return "Invalid input";
  } catch {
    // Non-JSON error body: fall through to the status text.
  }
  return response.statusText || `Request failed (${response.status})`;
}

export const api = {
  register: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (token: string) => request<AuthUser>("/api/auth/me", {}, token),

  getBook: (token: string) => request<PaperBookResponse>("/api/paper/book", {}, token),

  putBook: (token: string, body: PaperBookRequest) =>
    request<PaperBookResponse>("/api/paper/book", { method: "PUT", body: JSON.stringify(body) }, token),

  deleteBook: (token: string) => request<void>("/api/paper/book", { method: "DELETE" }, token),
};

/** The API's trade shape, which is snake_case and uses ISO timestamps. */
export interface ApiTrade {
  client_trade_id: string;
  symbol: string;
  product: string;
  side: string;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  charges: number;
}

export interface PaperBookRequest {
  snapshot: Record<string, unknown>;
  trades: ApiTrade[];
}

export interface PaperBookResponse {
  snapshot: Record<string, unknown>;
  trades: ApiTrade[];
  updated_at: string | null;
}

export function toApiTrade(trade: Trade): ApiTrade {
  return {
    client_trade_id: trade.id,
    symbol: trade.symbol,
    product: trade.product,
    side: trade.side,
    quantity: trade.quantity,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    entry_time: new Date(trade.entryTime).toISOString(),
    exit_time: new Date(trade.exitTime).toISOString(),
    pnl: trade.pnl,
    charges: trade.charges,
  };
}

/** True when the stored snapshot actually holds a book, rather than an untouched account. */
export function snapshotHasContent(snapshot: Record<string, unknown> | undefined): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const state = snapshot as Partial<PaperTradingState>;
  const orders: Order[] = state.orders ?? [];
  const positions: Position[] = state.positions ?? [];
  const trades: Trade[] = state.trades ?? [];
  return orders.length > 0 || positions.length > 0 || trades.length > 0;
}

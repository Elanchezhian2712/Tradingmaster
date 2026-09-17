import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccountSnapshot,
  Order,
  PaperTradingEngine,
  PaperTradingState,
  PositionValuation,
  Trade,
} from "@trading-master/paper-trading";
import { ApiError, PaperBookResponse, api, snapshotHasContent, toApiTrade } from "./api/client";

const STORAGE_KEY = "trading-master.paper-book.v1";
/**
 * Prices arrive every second per subscribed symbol. Re-rendering the panels on
 * each one would be pure churn, so the snapshot is refreshed on a fixed beat
 * and immediately on anything that actually changes the book.
 */
const PRICE_FLUSH_MS = 500;
/** How often a changed book is pushed to the API. The book is small; the point is to not push on every fill. */
const SYNC_PUSH_MS = 5000;

export type SyncStatus = "off" | "loading" | "synced" | "pending" | "error";

export interface PaperTradingSnapshot {
  positions: PositionValuation[];
  orders: Order[];
  trades: Trade[];
  account: AccountSnapshot;
}

function snapshotOf(engine: PaperTradingEngine): PaperTradingSnapshot {
  return {
    positions: engine.getPositions(),
    orders: engine.getOrders(),
    trades: engine.getTrades(),
    account: engine.getAccount(),
  };
}

function loadPersisted(engine: PaperTradingEngine): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) engine.restore(JSON.parse(raw) as PaperTradingState);
  } catch {
    // A corrupt or unreadable book is not worth failing the app over: start fresh.
  }
}

function persist(engine: PaperTradingEngine): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.toJSON()));
  } catch {
    // Storage full or blocked — the in-memory book still works.
  }
}

export interface UsePaperTradingResult {
  engine: PaperTradingEngine;
  snapshot: PaperTradingSnapshot;
  syncStatus: SyncStatus;
  syncError: string | null;
  /** Clear the book everywhere: engine, browser storage and, when signed in, the server. */
  resetBook: () => Promise<void>;
}

/**
 * Owns the paper-trading engine for the app and exposes a snapshot React can
 * render. The engine itself stays outside React state: components read the
 * snapshot, and every mutation goes through the engine instance.
 *
 * With a token, the book is also synced to the API: pulled once on sign-in,
 * then pushed on a timer whenever it has changed. `localStorage` stays the
 * offline path, so the app works signed out and keeps working if the API is
 * down.
 */
export function usePaperTrading(token: string | null): UsePaperTradingResult {
  const engineRef = useRef<PaperTradingEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new PaperTradingEngine();
    loadPersisted(engineRef.current);
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<PaperTradingSnapshot>(() => snapshotOf(engine));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(token ? "loading" : "off");
  const [syncError, setSyncError] = useState<string | null>(null);
  const bookDirtyForSyncRef = useRef(false);
  /**
   * The token whose book has been pulled. Deliberately state, not a ref: a ref
   * set before the fetch resolves makes React StrictMode's mount -> cleanup ->
   * remount cycle skip the second pull while the first one's result is
   * discarded as cancelled, leaving the book stuck on "loading" forever.
   */
  const [pulledToken, setPulledToken] = useState<string | null>(null);

  useEffect(() => {
    let priceDirty = false;
    let bookDirty = false;

    const off = engine.subscribe((event) => {
      if (event.type === "price") {
        priceDirty = true;
        return;
      }
      bookDirty = true;
      bookDirtyForSyncRef.current = true;
      priceDirty = false;
      setSnapshot(snapshotOf(engine));
      persist(engine);
    });

    const interval = setInterval(() => {
      if (!priceDirty) return;
      priceDirty = false;
      setSnapshot(snapshotOf(engine));
      // Last prices are part of the persisted book, so a reload values
      // positions against the last price the app actually saw.
      if (bookDirty) persist(engine);
    }, PRICE_FLUSH_MS);

    return () => {
      off();
      clearInterval(interval);
    };
  }, [engine]);

  // Pull the server book once per sign-in.
  useEffect(() => {
    if (!token) {
      setSyncStatus("off");
      setSyncError(null);
      setPulledToken(null);
      return;
    }
    if (pulledToken === token) return;

    let cancelled = false;
    setSyncStatus("loading");
    api
      .getBook(token)
      .then((book: PaperBookResponse) => {
        if (cancelled) return;
        // The server is the shared source of truth, except when it has nothing
        // yet: a book built while signed out is pushed up rather than thrown
        // away on first sign-in.
        if (snapshotHasContent(book.snapshot)) {
          engine.restore(book.snapshot as unknown as PaperTradingState);
          persist(engine);
          setSnapshot(snapshotOf(engine));
          bookDirtyForSyncRef.current = false;
          setSyncStatus("synced");
        } else {
          bookDirtyForSyncRef.current = true;
          setSyncStatus("pending");
        }
        setSyncError(null);
        setPulledToken(token);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSyncStatus("error");
        setSyncError(err instanceof ApiError ? err.message : "Cannot reach the API");
      });

    return () => {
      cancelled = true;
    };
  }, [engine, token, pulledToken]);

  // Push a changed book on a timer.
  useEffect(() => {
    if (!token) return;
    let inFlight = false;

    async function push(): Promise<void> {
      // Never push before the pull has landed, or an empty local book would
      // overwrite the server copy it is about to receive.
      if (inFlight || !bookDirtyForSyncRef.current || pulledToken !== token) return;
      inFlight = true;
      // Cleared before the request, so a change made while it is in flight
      // marks the book dirty again rather than being swallowed by success.
      bookDirtyForSyncRef.current = false;
      try {
        await api.putBook(token!, {
          snapshot: engine.toJSON() as unknown as Record<string, unknown>,
          trades: engine.getTrades().map(toApiTrade),
        });
        setSyncStatus("synced");
        setSyncError(null);
      } catch (err: unknown) {
        bookDirtyForSyncRef.current = true;
        setSyncStatus("error");
        setSyncError(err instanceof ApiError ? err.message : "Cannot reach the API");
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(() => void push(), SYNC_PUSH_MS);
    return () => clearInterval(interval);
  }, [engine, token, pulledToken]);

  const resetBook = useCallback(async () => {
    engine.reset();
    clearPersistedBook();
    setSnapshot(snapshotOf(engine));
    bookDirtyForSyncRef.current = false;
    if (!token) return;
    try {
      await api.deleteBook(token);
      setSyncStatus("synced");
      setSyncError(null);
    } catch (err: unknown) {
      setSyncStatus("error");
      setSyncError(err instanceof ApiError ? err.message : "Cannot reach the API");
    }
  }, [engine, token]);

  return { engine, snapshot, syncStatus, syncError, resetBook };
}

export function clearPersistedBook(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the caller resets the in-memory engine either way.
  }
}

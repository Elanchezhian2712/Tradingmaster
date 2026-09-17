import { useCallback, useEffect, useState } from "react";
import { ApiError, AuthUser, api } from "./api/client";

const TOKEN_KEY = "trading-master.token.v1";

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Signed in for this tab only — the session still works.
  }
}

/**
 * Session state for the API. The app works fully signed out (the chart and the
 * paper book run locally), so a failure here never blocks anything: it just
 * means the book is not synced.
 */
export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(token !== null);
  const [error, setError] = useState<string | null>(null);

  // A stored token can be expired, or from a backend that is not running.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .me(token)
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Only a rejected token means signed out; an unreachable API should
        // not throw away a session that may still be valid.
        if (err instanceof ApiError && err.status === 401) {
          writeToken(null);
          setToken(null);
        }
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const authenticate = useCallback(async (action: "login" | "register", email: string, password: string) => {
    setError(null);
    try {
      const response = action === "login" ? await api.login(email, password) : await api.register(email, password);
      writeToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      return true;
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Cannot reach the API");
      return false;
    }
  }, []);

  const signIn = useCallback((email: string, password: string) => authenticate("login", email, password), [authenticate]);
  const signUp = useCallback((email: string, password: string) => authenticate("register", email, password), [authenticate]);

  const signOut = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  return { token, user, loading, error, signIn, signUp, signOut };
}

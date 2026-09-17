import { useState } from "react";
import { AuthState } from "../useAuth";
import { SyncStatus } from "../usePaperTrading";

export interface AccountPanelProps {
  auth: AuthState;
  syncStatus: SyncStatus;
  syncError: string | null;
  onResetBook: () => void;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "This browser only",
  loading: "Loading your book…",
  synced: "Synced",
  pending: "Waiting to sync…",
  error: "Sync failed",
};

export function AccountPanel(props: AccountPanelProps) {
  const { auth } = props;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "signIn" | "signUp"): Promise<void> {
    setBusy(true);
    await (action === "signIn" ? auth.signIn(email, password) : auth.signUp(email, password));
    setBusy(false);
    setPassword("");
  }

  if (auth.user) {
    return (
      <div className="account-panel">
        <div className="panel-title">Account</div>
        <div className="account-row">
          <span className="account-email">{auth.user.email}</span>
          <button className="icon-btn small" onClick={auth.signOut}>
            Sign out
          </button>
        </div>
        <div className={`sync-status ${props.syncStatus}`}>
          {STATUS_LABEL[props.syncStatus]}
          {props.syncError && <span className="sync-error"> — {props.syncError}</span>}
        </div>
        <button className="icon-btn small" onClick={props.onResetBook}>
          Reset paper book
        </button>
      </div>
    );
  }

  return (
    <div className="account-panel">
      <div className="panel-title">Account</div>
      <div className="account-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void submit("signIn");
          }}
          aria-label="Password"
        />
        <div className="account-actions">
          <button className="icon-btn" disabled={busy} onClick={() => void submit("signIn")}>
            Sign in
          </button>
          <button className="icon-btn" disabled={busy} onClick={() => void submit("signUp")}>
            Create account
          </button>
        </div>
      </div>
      {auth.error && <div className="ticket-feedback error">{auth.error}</div>}
      <div className="ticket-note">
        Optional. Signed out, the paper book lives in this browser only; sign in to keep it across devices.
      </div>
    </div>
  );
}

import { LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../components/chat/avatar";
import { useChatStore } from "../store/chat-store";

export function ProfileScreen() {
  const selfUser = useChatStore((state) => state.selfUser);
  const signOut = useChatStore((state) => state.signOut);
  const refreshProfileFromZalo = useChatStore((state) => state.refreshProfileFromZalo);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function syncFromZalo() {
    setSyncing(true);
    setError(null);
    try {
      await refreshProfileFromZalo();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sync from Zalo");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div className="screen-title">Profile</div>
      </header>

      <div className="profile-card">
        <Avatar
          url={selfUser?.avatarUrl ?? null}
          label={selfUser?.avatarLabel ?? "?"}
          className="profile-avatar-img"
        />
        <div className="profile-name">{selfUser?.name ?? "—"}</div>
        <div className="profile-handle">@{selfUser?.handle ?? "—"}</div>
      </div>

      <button type="button" className="profile-action" onClick={() => void syncFromZalo()} disabled={syncing}>
        <RefreshCw size={18} strokeWidth={2} className={syncing ? "spin" : ""} />
        <span>{syncing ? "Syncing…" : "Sync from Zalo"}</span>
      </button>
      {error ? <p className="muted screen-message" role="alert">{error}</p> : null}

      <button type="button" className="profile-action danger" onClick={() => void signOut()}>
        <LogOut size={18} strokeWidth={2} />
        <span>Sign out</span>
      </button>
    </section>
  );
}

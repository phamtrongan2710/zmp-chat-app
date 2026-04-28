import { LogOut } from "lucide-react";
import { Avatar } from "../components/chat/avatar";
import { useChatStore } from "../store/chat-store";

export function ProfileScreen() {
  const selfUser = useChatStore((state) => state.selfUser);
  const signOut = useChatStore((state) => state.signOut);

  return (
    <section className="screen">
      <header className="screen-header">
        <div className="screen-title">Profile</div>
      </header>

      <div className="profile-card">
        <div className="profile-avatar">
          <Avatar url={selfUser?.avatarUrl ?? null} label={selfUser?.avatarLabel ?? "?"} className="profile-avatar-img" />
        </div>
        <div className="profile-name">{selfUser?.name ?? "—"}</div>
        <div className="profile-handle">@{selfUser?.handle ?? "—"}</div>
      </div>

      <div className="profile-fields">
        <div className="profile-field">
          <span className="profile-field-label">Display name</span>
          <span className="profile-field-value">{selfUser?.name ?? "—"}</span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">Handle</span>
          <span className="profile-field-value">@{selfUser?.handle ?? "—"}</span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">User ID</span>
          <span className="profile-field-value mono">{selfUser?.id ?? "—"}</span>
        </div>
      </div>

      <button type="button" className="profile-signout" onClick={() => void signOut()}>
        <LogOut size={18} strokeWidth={2} />
        <span>Sign out</span>
      </button>
    </section>
  );
}

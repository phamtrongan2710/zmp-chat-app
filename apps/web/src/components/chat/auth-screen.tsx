import { useChatStore } from "../../store/chat-store";

export function AuthScreen() {
  const users = useChatStore((state) => state.availableUsers);
  const selectUser = useChatStore((state) => state.selectUser);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">ZMP Chat</div>
        <h1 className="auth-title">Choose a local account</h1>
        <p className="muted">
          This first build keeps auth intentionally simple: pick one of the two local demo users and open the
          same 1:1 conversation from that perspective.
        </p>
        <div className="auth-user-list">
          {users.map((user) => (
            <button key={user.id} className="auth-user-card" onClick={() => void selectUser(user.id)} type="button">
              <div className="avatar">{user.avatarLabel}</div>
              <div>
                <div className="chat-list-item-title">{user.name}</div>
                <div className="chat-list-item-preview">{user.handle}</div>
              </div>
              <div className={`presence-dot ${user.online ? "online" : ""}`} />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

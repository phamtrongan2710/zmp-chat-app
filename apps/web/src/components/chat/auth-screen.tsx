import { useState } from "react";
import { getAccessToken } from "zmp-sdk";
import { postZmpLogin } from "../../lib/auth-api";
import { writeAppJwt } from "../../lib/auth-session";
import { useChatStore } from "../../store/chat-store";

export function AuthScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialize = useChatStore((state) => state.initialize);

  async function startLogin() {
    setPending(true);
    setError(null);
    try {
      const accessToken = await getAccessToken({});
      if (!accessToken) {
        throw new Error("Zalo did not return an access token");
      }
      const session = await postZmpLogin({ accessToken });
      writeAppJwt(session.appJwt);
      await initialize();
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">ZMP Chat</div>
        <h1 className="auth-title">Sign in to start chatting</h1>
        <p className="muted">We use your Zalo account to verify who you are.</p>
        <button className="auth-user-card" onClick={startLogin} type="button" disabled={pending}>
          <div className="avatar">Z</div>
          <div>
            <div className="chat-list-item-title">{pending ? "Signing in..." : "Login with Zalo"}</div>
            <div className="chat-list-item-preview">via Zalo Mini App</div>
          </div>
        </button>
        {error ? <p className="muted" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

import { useState } from "react";
import { fetchAuthorizeUrl } from "../../lib/auth-api";
import { writePkceStash } from "../../lib/auth-session";

export function AuthScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLogin() {
    setPending(true);
    setError(null);
    try {
      const { url, state, codeVerifier } = await fetchAuthorizeUrl();
      writePkceStash({ codeVerifier, state });
      window.location.href = url;
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : "Unable to start login");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">ZMP Chat</div>
        <h1 className="auth-title">Sign in to start chatting</h1>
        <p className="muted">We use Zalo to verify who you are. We never see your password.</p>
        <button className="auth-user-card" onClick={startLogin} type="button" disabled={pending}>
          <div className="avatar">Z</div>
          <div>
            <div className="chat-list-item-title">{pending ? "Redirecting..." : "Login with Zalo"}</div>
            <div className="chat-list-item-preview">OAuth 2.0 with PKCE</div>
          </div>
        </button>
        {error ? <p className="muted" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

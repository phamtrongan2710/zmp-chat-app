import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { postZaloCallback } from "../../lib/auth-api";
import { clearPkceStash, readPkceStash, writeAppJwt } from "../../lib/auth-session";

export function ZaloCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const stash = readPkceStash();

    if (!code || !state) {
      setError("Missing code or state from Zalo redirect.");
      return;
    }
    if (!stash || stash.state !== state) {
      setError("State mismatch. Please retry login.");
      clearPkceStash();
      return;
    }

    void (async () => {
      try {
        const session = await postZaloCallback({ code, state, codeVerifier: stash.codeVerifier });
        writeAppJwt(session.appJwt);
        clearPkceStash();
        navigate("/", { replace: true });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Login failed");
      }
    })();
  }, [params, navigate]);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">ZMP Chat</div>
        {error ? (
          <>
            <h1 className="auth-title">Login failed</h1>
            <p className="muted" role="alert">{error}</p>
            <button className="status-pill clickable-pill" type="button" onClick={() => navigate("/", { replace: true })}>
              back to login
            </button>
          </>
        ) : (
          <p className="muted">Completing Zalo login...</p>
        )}
      </section>
    </main>
  );
}

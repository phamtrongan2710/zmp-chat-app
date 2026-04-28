import { useState } from "react";
import { authorize, getUserID, getUserInfo } from "zmp-sdk";
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
      const zaloId = await getUserID({});
      if (!zaloId) throw new Error("Could not read Zalo user ID");

      let name = `User ${zaloId.slice(-6)}`;
      let avatar: string | null = null;
      try {
        await authorize({ scopes: ["scope.userInfo"] });
        const { userInfo } = await getUserInfo({ avatarType: "normal" });
        if (userInfo?.name) name = userInfo.name;
        if (userInfo?.avatar) avatar = userInfo.avatar;
      } catch (cause) {
        console.warn("[auth] could not load Zalo profile, signing in with placeholder", cause);
      }

      const session = await postZmpLogin({ zaloId, name, avatar });
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

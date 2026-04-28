import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/chat/avatar";
import { apiRequest } from "../lib/api-client";
import type { AuthenticatedUser } from "../lib/auth-api";
import { useChatStore } from "../store/chat-store";

export function NewChatScreen() {
  const startChatWith = useChatStore((state) => state.startChatWith);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuthenticatedUser[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setPending(true);
      setError(null);
      try {
        const data = await apiRequest<AuthenticatedUser[]>(
          `/users/search?q=${encodeURIComponent(trimmed)}`,
          { method: "GET" },
        );
        if (!cancelled) setResults(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Search failed");
      } finally {
        if (!cancelled) setPending(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  async function startChat(peerUserId: string) {
    const chatId = await startChatWith(peerUserId);
    if (chatId) navigate(`/chats/${chatId}`, { replace: true });
  }

  return (
    <section className="screen full-screen">
      <header className="conversation-header-bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Back"
          onClick={() => navigate("/")}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <div className="conversation-header-title">New chat</div>
      </header>

      <div className="screen-toolbar">
        <label className="search-field">
          <Search size={16} strokeWidth={2} className="search-field-icon" />
          <input
            type="search"
            placeholder="Search by name or handle"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="muted screen-message" role="alert">{error}</p> : null}
      {pending ? <p className="muted screen-message">Searching…</p> : null}

      <ul className="chat-list">
        {results.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              className="chat-list-item"
              onClick={() => void startChat(user.id)}
            >
              <Avatar url={user.avatarUrl} label={user.avatarLabel} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-row">
                  <span className="chat-list-item-title">{user.name}</span>
                </div>
                <div className="chat-list-item-preview">@{user.handle}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!pending && query.trim() && results.length === 0 ? (
        <p className="muted screen-message">No users matched.</p>
      ) : null}
    </section>
  );
}

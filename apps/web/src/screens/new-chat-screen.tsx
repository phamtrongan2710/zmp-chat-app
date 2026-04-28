import { ChevronLeft, Search, UserPlus } from "lucide-react";
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
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    const debounceMs = trimmed ? 200 : 0;

    const handle = setTimeout(async () => {
      setPending(true);
      setError(null);
      try {
        const url = trimmed
          ? `/users/search?q=${encodeURIComponent(trimmed)}`
          : "/users/search";
        const data = await apiRequest<AuthenticatedUser[]>(url, { method: "GET" });
        if (!cancelled) setResults(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Search failed");
      } finally {
        if (!cancelled) setPending(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  async function startChat(peerUserId: string) {
    setStarting(peerUserId);
    try {
      const chatId = await startChatWith(peerUserId);
      if (chatId) navigate(`/chats/${chatId}`, { replace: true });
      else setError("Could not start chat");
    } finally {
      setStarting(null);
    }
  }

  const trimmed = query.trim();
  const hasResults = results.length > 0;
  const sectionLabel = trimmed ? "Search results" : "Suggested";

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

      {hasResults ? <div className="section-label">{sectionLabel}</div> : null}

      <ul className="chat-list">
        {results.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              className="chat-list-item"
              onClick={() => void startChat(user.id)}
              disabled={starting !== null}
            >
              <Avatar url={user.avatarUrl} label={user.avatarLabel} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-row">
                  <span className="chat-list-item-title">{user.name}</span>
                </div>
                <div className="chat-list-item-preview">@{user.handle}</div>
              </div>
              {starting === user.id ? (
                <span className="chat-list-item-time">Opening…</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {!hasResults && pending ? (
        <p className="muted screen-message">Loading…</p>
      ) : null}

      {!hasResults && !pending ? (
        <div className="empty-state">
          <UserPlus size={48} strokeWidth={1.5} className="empty-state-icon" />
          <div className="empty-state-title">
            {trimmed ? "No users matched" : "No one to chat with yet"}
          </div>
          <div className="empty-state-subtitle">
            {trimmed
              ? "Try a different name or handle."
              : "Once other people sign in, they will show up here."}
          </div>
        </div>
      ) : null}
    </section>
  );
}

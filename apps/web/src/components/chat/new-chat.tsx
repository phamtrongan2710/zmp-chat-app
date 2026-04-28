import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import type { AuthenticatedUser } from "../../lib/auth-api";
import { useChatStore } from "../../store/chat-store";
import { Avatar } from "./avatar";

type Props = {
  onClose: () => void;
};

export function NewChat({ onClose }: Props) {
  const startChatWith = useChatStore((state) => state.startChatWith);
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
    if (chatId) onClose();
  }

  return (
    <div className="new-chat-panel">
      <div className="sidebar-header">
        <div className="brand">New chat</div>
        <button className="status-pill clickable-pill" type="button" onClick={onClose}>
          close
        </button>
      </div>
      <input
        className="sidebar-search"
        placeholder="Search by name or handle"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? (
        <p className="muted" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? <p className="muted">Searching...</p> : null}
      <div className="chat-list">
        {results.map((user) => (
          <button
            key={user.id}
            className="chat-list-item"
            type="button"
            onClick={() => void startChat(user.id)}
          >
            <Avatar url={user.avatarUrl} label={user.avatarLabel} />
            <div>
              <div className="chat-list-item-title">{user.name}</div>
              <div className="chat-list-item-preview">{user.handle}</div>
            </div>
          </button>
        ))}
        {!pending && query.trim() && results.length === 0 ? (
          <p className="muted">No users matched.</p>
        ) : null}
      </div>
    </div>
  );
}

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/chat/avatar";
import { useChatStore } from "../store/chat-store";

const FILTERS = ["All", "Unread", "Direct", "Groups"] as const;

export function ChatListScreen() {
  const chats = useChatStore((state) => state.chats);
  const selfUser = useChatStore((state) => state.selfUser);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim().toLowerCase();
  const visibleChats = trimmedQuery
    ? chats.filter((chat) => chat.title.toLowerCase().includes(trimmedQuery))
    : chats;

  return (
    <section className="screen">
      <header className="screen-header">
        <div className="screen-title">Messages</div>
        <button
          type="button"
          className="icon-button"
          aria-label="New chat"
          onClick={() => navigate("/new-chat")}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </header>

      <div className="screen-toolbar">
        <label className="search-field">
          <Search size={16} strokeWidth={2} className="search-field-icon" />
          <input
            type="search"
            placeholder="Search conversations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="filter-pills">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-pill ${filter === option ? "active" : ""}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {visibleChats.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">💬</div>
          <div className="empty-state-title">No conversations yet</div>
          <div className="empty-state-subtitle">Tap + above to start a new chat.</div>
        </div>
      ) : (
        <ul className="chat-list">
          {visibleChats.map((chat) => {
            const lastMessage = chat.messages.at(-1);
            const peer = chat.participants.find((user) => user.id !== selfUser?.id);
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  className="chat-list-item"
                  onClick={() => navigate(`/chats/${chat.id}`)}
                >
                  <div className="chat-list-item-avatar">
                    <Avatar url={peer?.avatarUrl ?? null} label={peer?.avatarLabel ?? "?"} />
                    {peer?.online ? <span className="presence-dot online" aria-label="online" /> : null}
                  </div>
                  <div className="chat-list-item-body">
                    <div className="chat-list-item-row">
                      <span className="chat-list-item-title">{chat.title}</span>
                      <span className="chat-list-item-time">
                        {lastMessage
                          ? new Date(lastMessage.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="chat-list-item-preview">{lastMessage?.content ?? "No messages yet"}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

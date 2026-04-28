import { useState } from "react";
import { useChatStore } from "../../store/chat-store";
import { Avatar } from "./avatar";
import { NewChat } from "./new-chat";

export function ChatSidebar() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const selfUser = useChatStore((state) => state.selfUser);
  const signOut = useChatStore((state) => state.signOut);
  const [showNewChat, setShowNewChat] = useState(false);

  if (showNewChat) {
    return (
      <aside className="sidebar">
        <NewChat onClose={() => setShowNewChat(false)} />
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="brand">ZMP Chat</div>
          <div className="muted">{selfUser?.handle}</div>
        </div>
        <div className="sidebar-actions">
          <button
            className="status-pill clickable-pill"
            onClick={() => setShowNewChat(true)}
            type="button"
          >
            new
          </button>
          <button
            className="status-pill clickable-pill"
            onClick={() => void signOut()}
            type="button"
          >
            sign out
          </button>
        </div>
      </div>

      <input className="sidebar-search" placeholder="Search conversations" />

      <div className="chat-list">
        {chats.length === 0 ? (
          <p className="muted">No chats yet. Use "new" to start one.</p>
        ) : null}
        {chats.map((chat) => {
          const lastMessage = chat.messages.at(-1);
          const peer = chat.participants.find((user) => user.id !== selfUser?.id);

          return (
            <button
              key={chat.id}
              className={`chat-list-item ${activeChatId === chat.id ? "active" : ""}`}
              onClick={() => setActiveChat(chat.id)}
              type="button"
            >
              <Avatar url={peer?.avatarUrl ?? null} label={peer?.avatarLabel ?? "DM"} />
              <div>
                <div className="chat-list-item-title">{chat.title}</div>
                <div className="chat-list-item-preview">{lastMessage?.content ?? "No messages yet"}</div>
              </div>
              <div className="muted">
                {lastMessage
                  ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

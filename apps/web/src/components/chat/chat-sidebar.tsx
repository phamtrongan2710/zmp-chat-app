import { useChatStore } from "../../store/chat-store";

export function ChatSidebar() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const selfUser = useChatStore((state) => state.selfUser);
  const clearSession = useChatStore((state) => state.clearSession);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="brand">ZMP Chat</div>
          <div className="muted">{selfUser?.handle}</div>
        </div>
        <button className="status-pill clickable-pill" onClick={clearSession} type="button">
          switch
        </button>
      </div>

      <input className="sidebar-search" placeholder="Search conversations" />

      <div className="chat-list">
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
              <div className="avatar">{peer?.avatarLabel ?? "DM"}</div>
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

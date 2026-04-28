import { useChatStore } from "../../store/chat-store";

export function ConversationView() {
  const selfUserId = useChatStore((state) => state.selfUserId);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const typingByChat = useChatStore((state) => state.typingByChat);
  const chat = useChatStore((state) => state.chats.find((item) => item.id === activeChatId));

  if (!chat) {
    return null;
  }

  const peer = chat.participants.find((participant) => participant.id !== selfUserId);
  const peerIsTyping = (typingByChat[chat.id] ?? []).includes(peer?.id ?? "");

  return (
    <>
      <header className="conversation-header">
        <div>
          <div className="brand">{peer?.name ?? chat.title}</div>
          <div className="muted">{peerIsTyping ? "typing..." : peer?.online ? "online now" : "offline"}</div>
        </div>
        <div className="status-pill">local realtime</div>
      </header>

      <section className="messages">
        {chat.messages.map((message) => {
          const isSelf = message.senderId === selfUserId;

          return (
            <div key={message.id} className={`message-row ${isSelf ? "self" : ""}`}>
              <div className="message-bubble">
                <div>{message.content}</div>
                <div className="message-meta">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {isSelf ? ` • ${message.status}` : ""}
                </div>
              </div>
            </div>
          );
        })}
        {peerIsTyping ? (
          <div className="message-row">
            <div className="message-bubble typing-bubble" aria-label={`${peer?.name ?? "Peer"} is typing`}>
              <div className="typing-placeholder" aria-hidden="true">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

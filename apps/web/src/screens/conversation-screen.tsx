import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/chat/avatar";
import { Composer } from "../components/chat/composer";
import { ConversationView } from "../components/chat/conversation-view";
import { useChatStore } from "../store/chat-store";

export function ConversationScreen() {
  const { chatId = "" } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const selfUserId = useChatStore((state) => state.selfUserId);
  const chat = useChatStore((state) => state.chats.find((item) => item.id === chatId));
  const typingByChat = useChatStore((state) => state.typingByChat);

  useEffect(() => {
    setActiveChat(chatId);
    return () => setActiveChat("");
  }, [chatId, setActiveChat]);

  if (!chat) {
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
          <div className="conversation-header-title">Conversation</div>
        </header>
        <div className="empty-state">
          <div className="empty-state-title">Conversation not found</div>
          <button type="button" className="primary-button" onClick={() => navigate("/")}>
            Back to messages
          </button>
        </div>
      </section>
    );
  }

  const peer = chat.participants.find((participant) => participant.id !== selfUserId);
  const peerIsTyping = peer ? (typingByChat[chatId] ?? []).includes(peer.id) : false;
  const status = peerIsTyping ? "typing..." : peer?.online ? "online" : "offline";

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
        <div className="conversation-header-peer">
          <div className="conversation-header-avatar">
            <Avatar url={peer?.avatarUrl ?? null} label={peer?.avatarLabel ?? "?"} className="header-avatar" />
            {peer?.online ? <span className="presence-dot online" aria-label="online" /> : null}
          </div>
          <div className="conversation-header-text">
            <div className="conversation-header-name">{peer?.name ?? chat.title}</div>
            <div className="conversation-header-status">{status}</div>
          </div>
        </div>
      </header>
      <ConversationView />
      <Composer />
    </section>
  );
}

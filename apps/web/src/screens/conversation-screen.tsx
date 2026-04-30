import { CSSProperties, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Composer } from "../components/chat/composer";
import { ConversationHeader, getConversationPeer } from "../components/chat/conversation-header";
import { ConversationView } from "../components/chat/conversation-view";
import { useChatStore } from "../store/chat-store";

export function ConversationScreen() {
  const { chatId = "" } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [viewportStyle, setViewportStyle] = useState<CSSProperties>({});
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const selfUserId = useChatStore((state) => state.selfUserId);
  const chat = useChatStore((state) => state.chats.find((item) => item.id === chatId));
  const typingByChat = useChatStore((state) => state.typingByChat);

  useEffect(() => {
    setActiveChat(chatId);
    return () => setActiveChat("");
  }, [chatId, setActiveChat]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const syncViewport = () => {
      setViewportStyle({
        "--conversation-viewport-height": `${vv.height}px`,
        "--conversation-viewport-offset-top": `${vv.offsetTop}px`,
      } as CSSProperties);
    };

    syncViewport();
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
    return () => {
      vv.removeEventListener("resize", syncViewport);
      vv.removeEventListener("scroll", syncViewport);
    };
  }, []);

  if (!chat) {
    return (
      <section className="screen full-screen conversation-screen" style={viewportStyle}>
        <ConversationHeader title="Conversation" onBack={() => navigate("/")} />
        <div className="empty-state">
          <div className="empty-state-title">Conversation not found</div>
          <button type="button" className="primary-button" onClick={() => navigate("/")}>
            Back to messages
          </button>
        </div>
      </section>
    );
  }

  const peer = getConversationPeer(chat, selfUserId);
  const peerIsTyping = peer ? (typingByChat[chatId] ?? []).includes(peer.id) : false;
  const status = peerIsTyping ? "typing..." : peer?.online ? "online" : "offline";

  return (
    <section className="screen full-screen conversation-screen" style={viewportStyle}>
      <div className="conversation-shell">
        <ConversationHeader
          title={chat.title}
          peer={peer}
          status={status}
          onBack={() => navigate("/")}
        />
        <ConversationView />
      </div>
      <Composer />
    </section>
  );
}

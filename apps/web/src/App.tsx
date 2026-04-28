import { useEffect } from "react";
import { io } from "socket.io-client";
import { AuthScreen } from "./components/chat/auth-screen";
import { ChatSidebar } from "./components/chat/chat-sidebar";
import { ConversationView } from "./components/chat/conversation-view";
import { Composer } from "./components/chat/composer";
import { setUnauthorizedHandler } from "./lib/api-client";
import { readAppJwt } from "./lib/auth-session";
import type { Message } from "./store/chat-store";
import { useChatStore } from "./store/chat-store";

const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:3000";

export function App() {
  const initialize = useChatStore((state) => state.initialize);
  const disconnectRealtime = useChatStore((state) => state.disconnectRealtime);
  const setSocket = useChatStore((state) => state.setSocket);
  const receiveMessage = useChatStore((state) => state.receiveMessage);
  const updatePresence = useChatStore((state) => state.updatePresence);
  const syncPresence = useChatStore((state) => state.syncPresence);
  const updateTyping = useChatStore((state) => state.updateTyping);
  const sendTyping = useChatStore((state) => state.sendTyping);
  const selfUserId = useChatStore((state) => state.selfUserId);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const isHydrated = useChatStore((state) => state.isHydrated);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (window.location.pathname !== "/") {
        window.location.assign("/");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!readAppJwt()) return;
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!selfUserId) {
      setSocket(null);
      return;
    }

    const socket = io(`${API_URL}/chat`, {
      transports: ["websocket"],
      query: { userId: selfUserId },
    });

    socket.on("connect", () => {
      const currentActiveChatId = useChatStore.getState().activeChatId;
      if (currentActiveChatId) {
        socket.emit("presence.join", { userId: selfUserId, chatId: currentActiveChatId });
      }
    });

    socket.on("message.created", (message: Message) => {
      void receiveMessage(message);
    });

    socket.on("presence.updated", ({ userId, online }: { userId: string; online: boolean }) => {
      updatePresence(userId, online);
    });

    socket.on("presence.snapshot", ({ onlineUserIds }: { onlineUserIds: string[] }) => {
      syncPresence(onlineUserIds);
    });

    socket.on("typing.updated", ({ chatId, typingUsers }: { chatId: string; typingUsers: string[] }) => {
      updateTyping(chatId, typingUsers);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
      setSocket(null);
    };
  }, [receiveMessage, selfUserId, setSocket, syncPresence, updatePresence, updateTyping]);

  useEffect(() => {
    const stopRealtime = () => {
      sendTyping(false);
      disconnectRealtime();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendTyping(false);
      }
    };

    window.addEventListener("pagehide", stopRealtime);
    window.addEventListener("beforeunload", stopRealtime);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", stopRealtime);
      window.removeEventListener("beforeunload", stopRealtime);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disconnectRealtime, sendTyping]);

  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (socket?.connected && selfUserId && activeChatId) {
      socket.emit("presence.join", { userId: selfUserId, chatId: activeChatId });
    }
  }, [activeChatId, selfUserId]);

  if (!isHydrated) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand">ZMP Chat</div>
          <p className="muted">Loading local session...</p>
        </section>
      </main>
    );
  }

  if (!selfUserId) {
    return <AuthScreen />;
  }

  return (
    <main className="app-shell">
      <section className="telegram-shell">
        <ChatSidebar />
        <div className="conversation-shell">
          <ConversationView />
          <Composer />
        </div>
      </section>
    </main>
  );
}

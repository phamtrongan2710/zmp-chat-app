import { create } from "zustand";
import { Socket } from "socket.io-client";
import { apiRequest } from "../lib/api-client";
import type { AuthenticatedUser } from "../lib/auth-api";
import { fetchMe, postLogout } from "../lib/auth-api";
import { readAppJwt, writeAppJwt } from "../lib/auth-session";
import { readConversationCache, writeConversationCache } from "../lib/indexeddb";

export type User = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
  avatarUrl: string | null;
  online: boolean;
};

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  status: "sent" | "delivered";
};

export type Chat = {
  id: string;
  title: string;
  participants: User[];
  messages: Message[];
};

type BootstrapPayload = {
  self: User;
  chats: Chat[];
};

type ChatState = {
  selfUserId: string | null;
  selfUser: User | null;
  chats: Chat[];
  activeChatId: string;
  socket: Socket | null;
  typingByChat: Record<string, string[]>;
  isHydrated: boolean;
  initialize: () => Promise<void>;
  hydrate: () => Promise<void>;
  setActiveChat: (chatId: string) => void;
  setSocket: (socket: Socket | null) => void;
  disconnectRealtime: () => void;
  signOut: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  receiveMessage: (message: Message) => Promise<void>;
  acceptIncomingChat: (chat: Chat) => void;
  startChatWith: (peerUserId: string) => Promise<string | null>;
  updatePresence: (userId: string, online: boolean) => void;
  syncPresence: (onlineUserIds: string[]) => void;
  sendTyping: (isTyping: boolean) => void;
  updateTyping: (chatId: string, typingUsers: string[]) => void;
};

function asUser(user: AuthenticatedUser, online: boolean): User {
  return { ...user, online };
}

export const useChatStore = create<ChatState>((set, get) => ({
  selfUserId: null,
  selfUser: null,
  chats: [],
  activeChatId: "",
  socket: null,
  typingByChat: {},
  isHydrated: false,
  initialize: async () => {
    if (!readAppJwt()) {
      set({ isHydrated: true });
      return;
    }

    try {
      const me = await fetchMe();
      set({ selfUserId: me.id, selfUser: asUser(me, true) });
      await get().hydrate();
    } catch {
      writeAppJwt(null);
      set({ selfUserId: null, selfUser: null, chats: [], activeChatId: "" });
    } finally {
      set({ isHydrated: true });
    }
  },
  hydrate: async () => {
    const userId = get().selfUserId;
    if (!userId) return;

    try {
      const payload = await apiRequest<BootstrapPayload>("/chat/bootstrap", { method: "GET" });
      const [activeChat] = payload.chats;
      set({
        selfUserId: payload.self.id,
        selfUser: payload.self,
        chats: payload.chats,
        activeChatId: activeChat?.id ?? "",
      });

      for (const chat of payload.chats) {
        await writeConversationCache({
          chatId: `${payload.self.id}:${chat.id}`,
          payload: JSON.stringify(chat),
        });
      }
      return;
    } catch {
      // Fall through to cached read so the UI can still render messages offline.
    }

    const cachedChats: Chat[] = [];
    for (const candidate of get().chats) {
      const cached = await readConversationCache(`${userId}:${candidate.id}`);
      if (cached) {
        cachedChats.push(JSON.parse(cached.payload) as Chat);
      }
    }

    if (cachedChats.length > 0) {
      set({ chats: cachedChats, activeChatId: cachedChats[0].id });
    }
  },
  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
    const userId = get().selfUserId;
    if (userId) {
      get().socket?.emit("presence.join", { userId, chatId });
    }
  },
  setSocket: (socket) => {
    set({ socket });
  },
  disconnectRealtime: () => {
    const { socket, selfUserId, activeChatId } = get();
    if (socket?.connected && selfUserId && activeChatId) {
      socket.emit("typing.update", {
        chatId: activeChatId,
        userId: selfUserId,
        isTyping: false,
      });
    }

    socket?.disconnect();
    set({ socket: null });
  },
  signOut: async () => {
    try {
      await postLogout();
    } catch {
      // Token may already be invalid; we'll clear local state regardless.
    }

    writeAppJwt(null);
    get().disconnectRealtime();
    set({
      selfUserId: null,
      selfUser: null,
      chats: [],
      activeChatId: "",
      socket: null,
      typingByChat: {},
      isHydrated: true,
    });
  },
  sendMessage: async (content: string) => {
    const activeChat = get().chats.find((chat) => chat.id === get().activeChatId);
    const selfUserId = get().selfUserId;
    if (!activeChat || !selfUserId || !content.trim()) {
      return;
    }

    const message: Message = {
      id: crypto.randomUUID(),
      chatId: activeChat.id,
      senderId: selfUserId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: "sent",
    };

    const nextChat = { ...activeChat, messages: [...activeChat.messages, message] };
    const nextChats = get().chats.map((chat) => (chat.id === nextChat.id ? nextChat : chat));
    set({ chats: nextChats });

    await writeConversationCache({
      chatId: `${selfUserId}:${nextChat.id}`,
      payload: JSON.stringify(nextChat),
    });

    get().sendTyping(false);
    get().socket?.emit("message.create", message);
  },
  receiveMessage: async (message: Message) => {
    const activeChat = get().chats.find((chat) => chat.id === message.chatId);
    const selfUserId = get().selfUserId;
    if (!activeChat || !selfUserId) {
      return;
    }

    const nextMessages = activeChat.messages.some((item) => item.id === message.id)
      ? activeChat.messages.map((item) => (item.id === message.id ? { ...item, status: message.status } : item))
      : [...activeChat.messages, message];
    const nextChat = { ...activeChat, messages: nextMessages };
    const nextChats = get().chats.map((chat) => (chat.id === nextChat.id ? nextChat : chat));
    set({ chats: nextChats });

    await writeConversationCache({
      chatId: `${selfUserId}:${nextChat.id}`,
      payload: JSON.stringify(nextChat),
    });
  },
  acceptIncomingChat: (chat: Chat) => {
    const existing = get().chats.find((existingChat) => existingChat.id === chat.id);
    if (existing) return;

    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: state.activeChatId || chat.id,
    }));

    const selfUserId = get().selfUserId;
    if (selfUserId) {
      void writeConversationCache({
        chatId: `${selfUserId}:${chat.id}`,
        payload: JSON.stringify(chat),
      });
    }
  },
  startChatWith: async (peerUserId: string) => {
    try {
      const chat = await apiRequest<Chat>("/chats", {
        method: "POST",
        body: { peerUserId },
      });
      get().acceptIncomingChat(chat);
      set({ activeChatId: chat.id });
      const userId = get().selfUserId;
      if (userId) {
        get().socket?.emit("presence.join", { userId, chatId: chat.id });
      }
      return chat.id;
    } catch {
      return null;
    }
  },
  updatePresence: (userId, online) => {
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((participant) =>
          participant.id === userId ? { ...participant, online } : participant,
        ),
      })),
      selfUser: state.selfUser?.id === userId ? { ...state.selfUser, online } : state.selfUser,
    }));
  },
  syncPresence: (onlineUserIds) => {
    const onlineUserSet = new Set(onlineUserIds);
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((participant) => ({
          ...participant,
          online: onlineUserSet.has(participant.id),
        })),
      })),
      selfUser: state.selfUser ? { ...state.selfUser, online: onlineUserSet.has(state.selfUser.id) } : state.selfUser,
    }));
  },
  sendTyping: (isTyping) => {
    const selfUserId = get().selfUserId;
    const activeChatId = get().activeChatId;
    if (!selfUserId || !activeChatId) {
      return;
    }

    get().socket?.emit("typing.update", {
      chatId: activeChatId,
      userId: selfUserId,
      isTyping,
    });
  },
  updateTyping: (chatId, typingUsers) => {
    set((state) => ({
      typingByChat: {
        ...state.typingByChat,
        [chatId]: typingUsers,
      },
    }));
  },
}));

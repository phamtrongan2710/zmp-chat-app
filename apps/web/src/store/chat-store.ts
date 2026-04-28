import { create } from "zustand";
import { Socket } from "socket.io-client";
import { readConversationCache, writeConversationCache } from "../lib/indexeddb";
import { readSessionUserId, writeSessionUserId } from "../lib/session";

export type User = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
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

type ChatState = {
  selfUserId: string | null;
  selfUser: User | null;
  availableUsers: User[];
  chats: Chat[];
  activeChatId: string;
  socket: Socket | null;
  typingByChat: Record<string, string[]>;
  isHydrated: boolean;
  initialize: () => Promise<void>;
  selectUser: (userId: string) => Promise<void>;
  clearSession: () => void;
  setActiveChat: (chatId: string) => void;
  hydrate: () => Promise<void>;
  setSocket: (socket: Socket | null) => void;
  disconnectRealtime: () => void;
  sendMessage: (content: string) => Promise<void>;
  receiveMessage: (message: Message) => Promise<void>;
  updatePresence: (userId: string, online: boolean) => void;
  syncPresence: (onlineUserIds: string[]) => void;
  sendTyping: (isTyping: boolean) => void;
  updateTyping: (chatId: string, typingUsers: string[]) => void;
};

const demoUsers: User[] = [
  { id: "user-me", name: "Taylor Reed", handle: "@taylor", avatarLabel: "TR", online: true },
  { id: "user-alex", name: "Alex Morgan", handle: "@alex", avatarLabel: "AM", online: true },
];

function buildDemoChat(selfUserId: string): Chat {
  const peer = demoUsers.find((user) => user.id !== selfUserId) ?? demoUsers[1];

  return {
    id: "chat-alex",
    title: peer.name,
    participants: demoUsers,
    messages: [
      {
        id: "seed-1",
        chatId: "chat-alex",
        senderId: "user-alex",
        content: "Local workspace is ready. Want to wire the realtime gateway first?",
        createdAt: new Date().toISOString(),
        status: "delivered",
      },
    ],
  };
}

const seedChat = buildDemoChat(demoUsers[0].id);

const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:3000";

export const useChatStore = create<ChatState>((set, get) => ({
  selfUserId: null,
  selfUser: null,
  availableUsers: demoUsers,
  chats: [seedChat],
  activeChatId: seedChat.id,
  socket: null,
  typingByChat: {},
  isHydrated: false,
  initialize: async () => {
    try {
      const response = await fetch(`${API_URL}/chat/users`);
      if (response.ok) {
        const availableUsers = (await response.json()) as User[];
        set({ availableUsers });
      }
    } catch {
      // Embedded demo users keep the app bootable without the API.
    }

    const sessionUserId = readSessionUserId();
    if (sessionUserId) {
      await get().selectUser(sessionUserId);
      return;
    }

    set({ isHydrated: true });
  },
  selectUser: async (userId) => {
    writeSessionUserId(userId);
    set({ selfUserId: userId, isHydrated: false, typingByChat: {} });
    await get().hydrate();
    set({ isHydrated: true });
  },
  clearSession: () => {
    writeSessionUserId(null);
    get().disconnectRealtime();
    set({
      selfUserId: null,
      selfUser: null,
      chats: [buildDemoChat(demoUsers[0].id)],
      activeChatId: seedChat.id,
      socket: null,
      typingByChat: {},
      isHydrated: true,
    });
  },
  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
    const userId = get().selfUserId;
    if (userId) {
      get().socket?.emit("presence.join", { userId, chatId });
    }
  },
  hydrate: async () => {
    const userId = get().selfUserId ?? readSessionUserId() ?? demoUsers[0].id;

    try {
      const response = await fetch(`${API_URL}/chat/bootstrap/${userId}`);
      if (response.ok) {
        const payload = (await response.json()) as { self: User; chats: Chat[] };
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
      }
    } catch {
      // The local cache keeps the UI usable when the API is offline.
    }

    const demoChat = buildDemoChat(userId);
    const cached = await readConversationCache(`${userId}:${demoChat.id}`);
    if (cached) {
      const restored = JSON.parse(cached.payload) as Chat;
      const selfUser = restored.participants.find((participant) => participant.id === userId) ?? null;
      set({ selfUserId: userId, selfUser, chats: [restored], activeChatId: restored.id });
      return;
    }

    const selfUser = demoUsers.find((participant) => participant.id === userId) ?? demoUsers[0];
    set({ selfUserId: selfUser.id, selfUser, chats: [demoChat], activeChatId: demoChat.id });
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
  updatePresence: (userId, online) => {
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((participant) =>
          participant.id === userId ? { ...participant, online } : participant,
        ),
      })),
      selfUser: state.selfUser?.id === userId ? { ...state.selfUser, online } : state.selfUser,
      availableUsers: state.availableUsers.map((user) => (user.id === userId ? { ...user, online } : user)),
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
      availableUsers: state.availableUsers.map((user) => ({
        ...user,
        online: onlineUserSet.has(user.id),
      })),
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

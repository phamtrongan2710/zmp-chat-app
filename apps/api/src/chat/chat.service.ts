import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MessageStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { DEFAULT_AI_BOT_HANDLE } from "../ai/ai.constants";
import { PrismaService } from "../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";

type User = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
  avatarUrl: string | null;
  online: boolean;
};

type Message = CreateMessageDto;

type Chat = {
  id: string;
  title: string;
  participants: User[];
  messages: Message[];
  hasMore: boolean;
};

type MessagePage = {
  messages: Message[];
  hasMore: boolean;
};

type ChatPage = {
  chats: Chat[];
  hasMore: boolean;
  nextCursor: string | null;
};

type ChatCursor = {
  id: string;
  lastMessageAt: string | null;
};

const CHAT_BOOTSTRAP_PAGE_SIZE = 15;
const MESSAGE_PAGE_SIZE = 30;

@Injectable()
export class ChatService {
  private readonly onlineUsers = new Map<string, number>();
  private readonly typingState = new Map<string, string[]>();

  constructor(private readonly prismaService: PrismaService) {}

  async getBootstrap(userId: string): Promise<{ self: User; chats: Chat[]; hasMoreChats: boolean; nextChatsCursor: string | null }> {
    const selfRow = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!selfRow) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const self = this.mapUser(selfRow);
    const page = await this.listChatsPageForUser(self.id, { limit: CHAT_BOOTSTRAP_PAGE_SIZE });

    return {
      self,
      chats: page.chats,
      hasMoreChats: page.hasMore,
      nextChatsCursor: page.nextCursor,
    };
  }

  async listChatsPageForUser(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<ChatPage> {
    const limit = options.limit ?? CHAT_BOOTSTRAP_PAGE_SIZE;
    const cursor = this.parseChatCursor(options.cursor);

    const rows = await this.prismaService.chat.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
        ...this.buildChatCursorWhere(cursor),
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ],
      take: limit + 1,
      include: {
        participants: {
          include: {
            user: true,
          },
          orderBy: { userId: "asc" },
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: MESSAGE_PAGE_SIZE + 1,
        },
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const chats = pageRows.map((chat) => this.serializeChat(chat, userId));
    const tail = pageRows.at(-1);

    return {
      chats,
      hasMore,
      nextCursor: hasMore && tail ? this.formatChatCursor(tail.id, tail.lastMessageAt) : null,
    };
  }

  async createOrGetDirectChat(userId: string, peerUserId: string): Promise<{ chat: Chat; created: boolean }> {
    if (userId === peerUserId) {
      throw new BadRequestException("Cannot start a chat with yourself");
    }

    const peer = await this.prismaService.user.findUnique({ where: { id: peerUserId } });
    if (!peer) {
      throw new NotFoundException("Peer not found");
    }

    const existing = await this.prismaService.chat.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: peerUserId } } },
        ],
      },
      include: {
        participants: { include: { user: true }, orderBy: { userId: "asc" } },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: MESSAGE_PAGE_SIZE + 1,
        },
      },
    });

    if (existing && existing.participants.length === 2) {
      return { chat: this.serializeChat(existing, userId), created: false };
    }

    const chatId = randomUUID();
    const created = await this.prismaService.chat.create({
      data: {
        id: chatId,
        participants: {
          create: [{ userId }, { userId: peerUserId }],
        },
      },
      include: {
        participants: { include: { user: true }, orderBy: { userId: "asc" } },
        messages: true,
      },
    });

    return { chat: this.serializeChat(created, userId), created: true };
  }

  private serializeChat(
    chat: {
      id: string;
      participants: Array<{ user: { id: string; name: string; handle: string; avatarLabel: string; avatarUrl: string | null } }>;
      messages: Array<{ id: string; chatId: string; senderId: string; content: string; createdAt: Date; status: MessageStatus }>;
    },
    viewerUserId: string,
  ): Chat {
    const participants = chat.participants.map((participant) => this.mapUser(participant.user));
    const peer = participants.find((participant) => participant.id !== viewerUserId);

    const hasMore = chat.messages.length > MESSAGE_PAGE_SIZE;
    const pageRows = hasMore ? chat.messages.slice(0, MESSAGE_PAGE_SIZE) : chat.messages;
    const messages = pageRows.map((message) => this.mapMessage(message)).reverse();

    return {
      id: chat.id,
      title: peer?.name ?? "Direct message",
      participants,
      messages,
      hasMore,
    };
  }

  async listMessagesPage(chatId: string, options: { before?: string; limit?: number } = {}): Promise<MessagePage> {
    const limit = options.limit ?? MESSAGE_PAGE_SIZE;

    let cursor: { createdAt: Date; id: string } | null = null;
    if (options.before) {
      const cursorRow = await this.prismaService.message.findUnique({
        where: { id: options.before },
        select: { id: true, chatId: true, createdAt: true },
      });
      if (!cursorRow || cursorRow.chatId !== chatId) {
        throw new BadRequestException("Invalid pagination cursor");
      }
      cursor = { id: cursorRow.id, createdAt: cursorRow.createdAt };
    }

    const rows = await this.prismaService.message.findMany({
      where: {
        chatId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const messages = pageRows.map((row) => this.mapMessage(row)).reverse();

    return { messages, hasMore };
  }

  async listMessagesPageForUser(
    chatId: string,
    userId: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<MessagePage> {
    await this.assertParticipant(chatId, userId);
    return this.listMessagesPage(chatId, options);
  }

  async createMessageForUser(payload: CreateMessageDto, userId: string): Promise<Message> {
    if (payload.senderId !== userId) {
      throw new ForbiddenException("Cannot send messages as another user");
    }
    await this.assertParticipant(payload.chatId, userId);
    return this.createMessage(payload);
  }

  async assertParticipant(chatId: string, userId: string): Promise<void> {
    const participant = await this.prismaService.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException("Not a participant of this chat");
    }
  }

  async createMessage(payload: CreateMessageDto): Promise<Message> {
    const nextMessage: Message = {
      ...payload,
      status: (await this.isPeerOnline(payload.chatId, payload.senderId)) ? "delivered" : "sent",
    };

    await this.prismaService.message.upsert({
      where: { id: nextMessage.id },
      update: {
        content: nextMessage.content,
        createdAt: new Date(nextMessage.createdAt),
        status: nextMessage.status as MessageStatus,
      },
      create: {
        id: nextMessage.id,
        chatId: nextMessage.chatId,
        senderId: nextMessage.senderId,
        content: nextMessage.content,
        createdAt: new Date(nextMessage.createdAt),
        status: nextMessage.status as MessageStatus,
      },
    });

    await this.prismaService.chat.updateMany({
      where: {
        id: nextMessage.chatId,
        OR: [
          { lastMessageAt: null },
          { lastMessageAt: { lt: new Date(nextMessage.createdAt) } },
        ],
      },
      data: { lastMessageAt: new Date(nextMessage.createdAt) },
    });

    return nextMessage;
  }

  /**
   * Marks a user as online or offline and tracks their connection count.
   * 
   * This function maintains a reference count for each user to handle multiple concurrent connections.
   * When a user goes online, their connection count increases; when they go offline, it decreases.
   * 
   * @param userId - The unique identifier of the user
   * @param online - Boolean flag indicating whether the user is coming online (true) or going offline (false)
   * 
   * @returns Boolean indicating a status change:
   *          - If online=true: returns true if this is the user's first connection (count went from 0 to 1)
   *          - If online=false: returns true if the user had active connections before (count was > 0), false otherwise
   *          - Returns false if going offline but not the last connection (count > 1)
   * 
   * @description
   * Step by step:
   * 1. If marking online: increment the connection count for the user and return true only if it's their first connection
   * 2. If marking offline: check the current connection count
   * 3. If count is 1 or less, delete the user from the online map and return true if they had an active connection
   * 4. If count is greater than 1, decrement the count and return false (user still has other active connections)
   */
  markUserOnline(userId: string, online: boolean): boolean {
    if (online) {
      const nextCount = (this.onlineUsers.get(userId) ?? 0) + 1;
      this.onlineUsers.set(userId, nextCount);
      return nextCount === 1;
    }

    const currentCount = this.onlineUsers.get(userId) ?? 0;
    if (currentCount <= 1) {
      this.onlineUsers.delete(userId);
      return currentCount > 0;
    }

    this.onlineUsers.set(userId, currentCount - 1);
    return false;
  }

  /**
   * Updates the typing state for a specific chat by adding or removing a user's typing status.
   * 
   * This method manages a set of user IDs currently typing in the given chat. If `isTyping` is true,
   * the user ID is added to the set; if false, it is removed. The updated list of typing users is
   * stored and returned as an array.
   * 
   * @param chatId - The unique identifier of the chat.
   * @param userId - The unique identifier of the user whose typing status is being updated.
   * @param isTyping - A boolean indicating whether the user is starting (true) or stopping (false) to type.
   * @returns An array of user IDs currently typing in the chat after the update.
   */
  updateTyping(chatId: string, userId: string, isTyping: boolean): string[] {
    const current = new Set(this.typingState.get(chatId) ?? []);
    if (isTyping) {
      current.add(userId);
    } else {
      current.delete(userId);
    }

    const next = Array.from(current);
    this.typingState.set(chatId, next);
    return next;
  }

  /**
   * Clears the typing status for a specified user across all chats.
   * 
   * This method iterates through the typing state map, removes the user from the typing users list
   * for any chat where they are currently typing, updates the internal state, and collects the changes.
   * 
   * @param userId - The ID of the user whose typing status should be cleared.
   * @returns An array of objects, each containing the chat ID and the updated list of typing users
   *          after removing the specified user.
   */
  clearTypingForUser(userId: string): Array<{ chatId: string; typingUsers: string[] }> {
    const updates: Array<{ chatId: string; typingUsers: string[] }> = [];

    for (const [chatId, typingUsers] of this.typingState.entries()) {
      if (!typingUsers.includes(userId)) {
        continue;
      }

      const nextTypingUsers = typingUsers.filter((typingUserId) => typingUserId !== userId);
      this.typingState.set(chatId, nextTypingUsers);
      updates.push({ chatId, typingUsers: nextTypingUsers });
    }

    return updates;
  }

  private async isPeerOnline(chatId: string, senderId: string): Promise<boolean> {
    const rows = await this.prismaService.chatParticipant.findMany({
      where: { chatId },
      select: { userId: true },
    });

    return rows.some((row) => row.userId !== senderId && this.onlineUsers.has(row.userId));
  }

  private mapUser(row: {
    id: string;
    name: string;
    handle: string;
    avatarLabel: string;
    avatarUrl: string | null;
  }): User {
    return {
      id: row.id,
      name: row.name,
      handle: row.handle,
      avatarLabel: row.avatarLabel,
      avatarUrl: row.avatarUrl,
      online: row.handle === DEFAULT_AI_BOT_HANDLE || this.onlineUsers.has(row.id),
    };
  }

  listOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  private buildChatCursorWhere(cursor: ChatCursor | null) {
    if (!cursor) {
      return {};
    }

    if (!cursor.lastMessageAt) {
      return {
        lastMessageAt: null,
        id: { lt: cursor.id },
      };
    }

    const cursorDate = new Date(cursor.lastMessageAt);
    return {
      OR: [
        { lastMessageAt: { lt: cursorDate } },
        { lastMessageAt: cursorDate, id: { lt: cursor.id } },
        { lastMessageAt: null },
      ],
    };
  }

  private parseChatCursor(rawCursor?: string): ChatCursor | null {
    if (!rawCursor) {
      return null;
    }

    try {
      const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
      const parsed = JSON.parse(decoded) as Partial<ChatCursor>;
      const lastMessageAt = parsed.lastMessageAt ?? null;
      if (typeof parsed.id !== "string") {
        throw new Error("Missing chat id");
      }
      if (lastMessageAt !== null && Number.isNaN(Date.parse(lastMessageAt))) {
        throw new Error("Invalid lastMessageAt");
      }
      return { id: parsed.id, lastMessageAt };
    } catch {
      throw new BadRequestException("Invalid chat pagination cursor");
    }
  }

  private formatChatCursor(id: string, lastMessageAt: Date | null): string {
    return Buffer.from(
      JSON.stringify({
        id,
        lastMessageAt: lastMessageAt?.toISOString() ?? null,
      }),
      "utf8",
    ).toString("base64url");
  }

  private mapMessage(row: {
    id: string;
    chatId: string;
    senderId: string;
    content: string;
    createdAt: Date;
    status: MessageStatus;
  }): Message {
    return {
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      status: row.status,
    };
  }
}

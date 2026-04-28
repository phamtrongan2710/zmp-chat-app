import { Injectable, NotFoundException } from "@nestjs/common";
import { MessageStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";

type User = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
  online: boolean;
};

type Message = CreateMessageDto;

type Chat = {
  id: string;
  title: string;
  participants: User[];
  messages: Message[];
};

@Injectable()
export class ChatService {
  private readonly onlineUsers = new Map<string, number>();
  private readonly typingState = new Map<string, string[]>();

  constructor(private readonly prismaService: PrismaService) {}

  async listUsers(): Promise<User[]> {
    const rows = await this.prismaService.user.findMany({
      orderBy: { name: "asc" },
    });

    return rows.map((row) => this.mapUser(row));
  }

  
  async getBootstrap(userId: string): Promise<{ self: User; chats: Chat[] }> {
    const selfRow = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!selfRow) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const self = this.mapUser(selfRow);
    const chatRows = await this.prismaService.chat.findMany({
      where: {
        participants: {
          some: {
            userId: self.id,
          },
        },
      },
      orderBy: { id: "asc" },
      include: {
        participants: {
          include: {
            user: true,
          },
          orderBy: { userId: "asc" },
        },
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    const chatPayloads = await Promise.all(
      chatRows.map(async (chat) => {
        const participants = chat.participants.map((participant) => this.mapUser(participant.user));
        const peer = participants.find((participant) => participant.id !== self.id);

        return {
          id: chat.id,
          title: peer?.name ?? "Direct message",
          participants,
          messages: chat.messages.map((message) => this.mapMessage(message)),
        };
      }),
    );

    return { self, chats: chatPayloads };
  }

  async listMessages(chatId: string): Promise<Message[]> {
    const rows = await this.prismaService.message.findMany({
      where: { chatId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => this.mapMessage(row));
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

  private mapUser(row: { id: string; name: string; handle: string; avatarLabel: string }): User {
    return {
      id: row.id,
      name: row.name,
      handle: row.handle,
      avatarLabel: row.avatarLabel,
      online: this.onlineUsers.has(row.id),
    };
  }

  listOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
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

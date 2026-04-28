import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL");
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.seedData();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async seedData(): Promise<void> {
    await this.user.upsert({
      where: { id: "user-me" },
      update: {
        name: "Taylor Reed",
        handle: "@taylor",
        avatarLabel: "TR",
      },
      create: {
        id: "user-me",
        name: "Taylor Reed",
        handle: "@taylor",
        avatarLabel: "TR",
      },
    });

    await this.user.upsert({
      where: { id: "user-alex" },
      update: {
        name: "Alex Morgan",
        handle: "@alex",
        avatarLabel: "AM",
      },
      create: {
        id: "user-alex",
        name: "Alex Morgan",
        handle: "@alex",
        avatarLabel: "AM",
      },
    });

    await this.chat.upsert({
      where: { id: "chat-alex" },
      update: {},
      create: { id: "chat-alex" },
    });

    await this.chatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId: "chat-alex",
          userId: "user-me",
        },
      },
      update: {},
      create: {
        chatId: "chat-alex",
        userId: "user-me",
      },
    });

    await this.chatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId: "chat-alex",
          userId: "user-alex",
        },
      },
      update: {},
      create: {
        chatId: "chat-alex",
        userId: "user-alex",
      },
    });

    await this.message.upsert({
      where: { id: "seed-1" },
      update: {},
      create: {
        id: "seed-1",
        chatId: "chat-alex",
        senderId: "user-alex",
        content: "Local workspace is ready. Want to wire the realtime gateway first?",
        createdAt: new Date(),
        status: "delivered",
      },
    });
  }
}

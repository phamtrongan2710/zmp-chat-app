import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import {
  AI_TYPING_DELAY_MS,
  DEFAULT_AI_BOT_AVATAR_LABEL,
  DEFAULT_AI_BOT_HANDLE,
  DEFAULT_AI_BOT_NAME,
  DEFAULT_LLM_MODEL,
} from "./ai.constants";
import { RagService } from "./rag.service";

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly botName: string;
  private readonly botHandle: string;
  private botId: string | null = null;
  private readonly model: string;
  private readonly aiClient: GoogleGenAI | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
  ) {
    this.botName = this.configService.get<string>("AI_CHATBOT_NAME") ?? DEFAULT_AI_BOT_NAME;
    this.botHandle = this.configService.get<string>("AI_CHATBOT_HANDLE") ?? DEFAULT_AI_BOT_HANDLE;
    this.model = this.configService.get<string>("AI_CHATBOT_MODEL") ?? DEFAULT_LLM_MODEL;

    const apiKey = this.configService.get<string>("GOOGLE_API_KEY");
    this.aiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  getBotHandle(): string {
    return this.botHandle;
  }

  getBotId(): string | null {
    return this.botId;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBotUser();
    } catch (error) {
      this.logger.warn(`AI bot user bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureBotUser(): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { handle: this.botHandle },
    });

    if (existing) {
      this.botId = existing.id;
      if (existing.name !== this.botName || existing.avatarLabel !== DEFAULT_AI_BOT_AVATAR_LABEL) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: this.botName,
            avatarLabel: DEFAULT_AI_BOT_AVATAR_LABEL,
          },
        });
      }
      return;
    }

    const created = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        name: this.botName,
        handle: this.botHandle,
        avatarLabel: DEFAULT_AI_BOT_AVATAR_LABEL,
        avatarUrl: null,
      },
    });
    this.botId = created.id;
  }

  async getBotUser() {
    return this.prisma.user.findUnique({
      where: { handle: this.botHandle },
    });
  }

  async getBotParticipantForChat(chatId: string) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      include: { user: true },
      orderBy: { userId: "asc" },
    });

    return participants.find((participant) => participant.user.handle === this.botHandle)?.user ?? null;
  }

  isBotUserId(userId: string | null | undefined, botUserId: string | null | undefined): boolean {
    return Boolean(userId && botUserId && userId === botUserId);
  }

  async buildReply(chatId: string, question: string): Promise<string | null> {
    if (!this.aiClient) {
      this.logger.warn("GOOGLE_API_KEY is not configured; skipping AI reply");
      return null;
    }

    const botUser = await this.getBotUser();
    if (!botUser) {
      this.logger.warn("AI bot user is missing; skipping AI reply");
      return null;
    }

    const [retrievedChunks, historyRows] = await Promise.all([
      this.ragService.retrieve(question, 5),
      this.prisma.message.findMany({
        where: { chatId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 8,
      }),
    ]);

    const recentHistory = historyRows
      .reverse()
      .map((message) => `${message.senderId === botUser.id ? this.botName : "User"}: ${message.content}`)
      .join("\n");

    const contextBlock = retrievedChunks.length > 0
      ? retrievedChunks
          .map(
            (chunk, index) =>
              `[Context ${index + 1} | ${chunk.sourceFile} | chunk ${chunk.chunkIndex + 1}]\n${chunk.content}`,
          )
          .join("\n\n")
      : "No matching document context was found.";

    const response = await this.aiClient.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `You are ${this.botName}, an always-online assistant inside a chat app.`,
                "Answer in Vietnamese unless the user clearly asks for another language.",
                "Use the provided document context when it is relevant.",
                "If the answer is not supported by the provided context, say that you do not know based on the uploaded PDF.",
                "Keep the answer concise and natural for a chat conversation.",
                "",
                "Document context:",
                contextBlock,
                "",
                "Recent conversation:",
                recentHistory || "No prior messages.",
                "",
                `User question: ${question}`,
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const text = response.text?.trim();
    if (!text) {
      this.logger.warn("Gemini returned an empty response");
      return null;
    }

    return text;
  }

  getTypingDelayMs(): number {
    return AI_TYPING_DELAY_MS;
  }
}

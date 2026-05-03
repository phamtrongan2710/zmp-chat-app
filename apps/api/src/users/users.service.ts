import { Injectable } from "@nestjs/common";
import { AiService } from "../ai/ai.service";
import { PrismaService } from "../database/prisma.service";

export type SearchedUser = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
  avatarUrl: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async search(query: string, excludeUserId: string): Promise<SearchedUser[]> {
    const trimmed = query.trim();
    const where = trimmed
      ? {
          AND: [
            { id: { not: excludeUserId } },
            {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" as const } },
                { handle: { contains: trimmed, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : {
          AND: [{ id: { not: excludeUserId } }, { handle: this.aiService.getBotHandle() }],
        };

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      take: 20,
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      handle: row.handle,
      avatarLabel: row.avatarLabel,
      avatarUrl: row.avatarUrl,
    }));
  }
}

import { Injectable } from "@nestjs/common";
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
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, excludeUserId: string): Promise<SearchedUser[]> {
    const trimmed = query.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: excludeUserId } },
          {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { handle: { contains: trimmed, mode: "insensitive" } },
            ],
          },
        ],
      },
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

import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { PrismaService } from "../database/prisma.service";
import { AppJwtService } from "./jwt.service";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type AuthenticatedRequest = Request & {
  user: { id: string; sessionId: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: AppJwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers["authorization"];
    if (!header || typeof header !== "string" || !header.toLowerCase().startsWith("bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("bearer ".length).trim();
    const payload = this.jwtService.verify(token);

    const session = await this.prisma.session.findUnique({ where: { id: payload.jti } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException("Session revoked");
    }

    request.user = { id: payload.sub, sessionId: payload.jti };
    return true;
  }
}

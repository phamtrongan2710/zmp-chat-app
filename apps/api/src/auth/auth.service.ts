import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { EncryptionService } from "../crypto/encryption.service";
import { PrismaService } from "../database/prisma.service";
import { AuthConfig, ZALO_OAUTH_AUTHORIZE_URL, loadAuthConfig } from "./auth.config";
import { deriveAvatarLabel, deriveHandle, deriveHandleBase } from "./handle.util";
import { AppJwtService } from "./jwt.service";
import { generatePkcePair, generateState } from "./pkce.util";
import { ZaloClient, ZaloProfile, ZaloTokenResponse } from "./zalo.client";

export type AuthenticatedSession = {
  appJwt: string;
  user: {
    id: string;
    name: string;
    handle: string;
    avatarLabel: string;
    avatarUrl: string | null;
  };
};

@Injectable()
export class AuthService {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly zalo: ZaloClient,
    private readonly jwt: AppJwtService,
    private readonly encryption: EncryptionService,
  ) {
    this.config = loadAuthConfig(configService);
  }

  buildAuthorizeUrl(): { url: string; state: string; codeVerifier: string } {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = generateState();

    const params = new URLSearchParams({
      app_id: this.config.zaloAppId,
      redirect_uri: this.config.zaloRedirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return { url: `${ZALO_OAUTH_AUTHORIZE_URL}?${params.toString()}`, state, codeVerifier };
  }

  async handleCallback(code: string, codeVerifier: string): Promise<AuthenticatedSession> {
    const tokenResponse = await this.zalo.exchangeCode(code, codeVerifier);
    const profile = await this.zalo.fetchProfile(tokenResponse.accessToken);
    const user = await this.upsertUserFromProfile(profile);
    const session = await this.createSession(user.id, tokenResponse);

    const appJwt = this.jwt.sign({ sub: user.id, jti: session.id });

    return {
      appJwt,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatarLabel: user.avatarLabel,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async handleZmpLogin(input: { zaloId: string; name: string; avatar?: string | null }): Promise<AuthenticatedSession> {
    // graph.zalo.me/me is geo-blocked outside Vietnam, so we trust the Zalo
    // identity supplied by the mini-app SDK (getUserID + getUserInfo). The Zalo
    // ID is the only thing keyed on; cosmetic fields can be re-supplied on the
    // next login.
    const profile: ZaloProfile = {
      id: input.zaloId,
      name: input.name,
      avatarUrl: input.avatar ?? null,
    };
    const user = await this.upsertUserFromProfile(profile);
    const session = await this.createZmpSession(user.id, "");

    const appJwt = this.jwt.sign({ sub: user.id, jti: session.id });

    return {
      appJwt,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatarLabel: user.avatarLabel,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(expiredToken: string): Promise<{ appJwt: string }> {
    const payload = this.jwt.verifyAllowExpired(expiredToken);
    const session = await this.prisma.session.findUnique({ where: { id: payload.jti } });
    if (!session || session.revokedAt) {
      throw new BadRequestException("Session no longer valid");
    }

    await this.refreshZaloIfNeeded(session.id);
    const appJwt = this.jwt.sign({ sub: payload.sub, jti: payload.jti });
    return { appJwt };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async refreshZaloIfNeeded(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt) return;

    const expiresWithinWindow = session.zaloExpiresAt.getTime() - Date.now() < 60_000;
    if (!expiresWithinWindow) return;

    const refreshToken = this.encryption.decrypt(session.zaloRefreshToken);
    const refreshed = await this.zalo.refresh(refreshToken);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        zaloAccessToken: this.encryption.encrypt(refreshed.accessToken),
        zaloRefreshToken: this.encryption.encrypt(refreshed.refreshToken),
        zaloExpiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000),
      },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateProfile(userId: string, patch: { name?: string; avatar?: string | null }) {
    const data: { name?: string; avatarUrl?: string | null; avatarLabel?: string } = {};
    if (patch.name !== undefined) {
      data.name = patch.name;
      data.avatarLabel = deriveAvatarLabel(patch.name);
    }
    if (patch.avatar !== undefined) {
      data.avatarUrl = patch.avatar;
    }
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  private async upsertUserFromProfile(profile: ZaloProfile) {
    const existing = await this.prisma.user.findUnique({ where: { zaloId: profile.id } });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          avatarLabel: deriveAvatarLabel(profile.name),
        },
      });
    }

    const handle = await this.allocateHandle(profile.name);
    return this.prisma.user.create({
      data: {
        id: randomUUID(),
        zaloId: profile.id,
        name: profile.name,
        handle,
        avatarLabel: deriveAvatarLabel(profile.name),
        avatarUrl: profile.avatarUrl,
      },
    });
  }

  private async allocateHandle(name: string): Promise<string> {
    const base = deriveHandleBase(name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = deriveHandle(name);
      const taken = await this.prisma.user.findUnique({ where: { handle: candidate } });
      if (!taken) return candidate;
    }
    throw new Error(`Unable to allocate handle for ${base}`);
  }

  private async createSession(userId: string, token: ZaloTokenResponse) {
    return this.prisma.session.create({
      data: {
        id: randomUUID(),
        userId,
        zaloAccessToken: this.encryption.encrypt(token.accessToken),
        zaloRefreshToken: this.encryption.encrypt(token.refreshToken),
        zaloExpiresAt: new Date(Date.now() + token.expiresInSeconds * 1000),
      },
    });
  }

  // ZMP-issued access tokens cannot be refreshed server-side (no refresh token
  // is granted). Store an empty refresh token and set a far-future expiry so
  // refreshZaloIfNeeded never triggers a doomed refresh call.
  private async createZmpSession(userId: string, accessToken: string) {
    return this.prisma.session.create({
      data: {
        id: randomUUID(),
        userId,
        zaloAccessToken: this.encryption.encrypt(accessToken),
        zaloRefreshToken: this.encryption.encrypt(""),
        zaloExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

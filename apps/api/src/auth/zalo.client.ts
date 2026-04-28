import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthConfig, ZALO_GRAPH_ME_URL, ZALO_OAUTH_TOKEN_URL, loadAuthConfig } from "./auth.config";

export type ZaloTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

export type ZaloProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

@Injectable()
export class ZaloClient {
  private readonly config: AuthConfig;

  constructor(configService: ConfigService) {
    this.config = loadAuthConfig(configService);
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<ZaloTokenResponse> {
    const body = new URLSearchParams({
      code,
      app_id: this.config.zaloAppId,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });

    return this.postToken(body);
  }

  async refresh(refreshToken: string): Promise<ZaloTokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      app_id: this.config.zaloAppId,
      grant_type: "refresh_token",
    });

    return this.postToken(body);
  }

  async fetchProfile(accessToken: string): Promise<ZaloProfile> {
    const url = `${ZALO_GRAPH_ME_URL}?fields=id,name,picture`;
    const response = await fetch(url, {
      headers: { access_token: accessToken },
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Zalo profile fetch failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      id?: string;
      name?: string;
      picture?: { data?: { url?: string } };
      error?: number | string;
      message?: string;
    };

    if (json.error || !json.id || !json.name) {
      throw new InternalServerErrorException(
        `Zalo profile envelope error: ${json.error ?? "unknown"} ${json.message ?? ""}`.trim(),
      );
    }

    return {
      id: json.id,
      name: json.name,
      avatarUrl: json.picture?.data?.url ?? null,
    };
  }

  private async postToken(body: URLSearchParams): Promise<ZaloTokenResponse> {
    const response = await fetch(ZALO_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: this.config.zaloAppSecret,
      },
      body,
    });

    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: string | number;
      error?: number | string;
      error_description?: string;
      error_name?: string;
    };

    if (!response.ok || json.error || !json.access_token || !json.refresh_token) {
      const description = json.error_description ?? json.error_name ?? "unknown";
      throw new BadRequestException(`Zalo token exchange failed: ${description}`);
    }

    const expiresInSeconds = typeof json.expires_in === "string" ? Number(json.expires_in) : json.expires_in ?? 3600;

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresInSeconds: Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600,
    };
  }
}

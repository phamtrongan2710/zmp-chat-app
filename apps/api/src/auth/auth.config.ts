import { ConfigService } from "@nestjs/config";

export type AuthConfig = {
  zaloAppId: string;
  zaloAppSecret: string;
  zaloRedirectUri: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
};

export function loadAuthConfig(configService: ConfigService): AuthConfig {
  const zaloAppId = configService.get<string>("ZALO_APP_ID");
  const zaloAppSecret = configService.get<string>("ZALO_APP_SECRET");
  const zaloRedirectUri = configService.get<string>("ZALO_REDIRECT_URI");
  const jwtSecret = configService.get<string>("APP_JWT_SECRET");
  const jwtTtlRaw = configService.get<string>("APP_JWT_TTL_SECONDS");

  if (!zaloAppId) throw new Error("ZALO_APP_ID is required");
  if (!zaloAppSecret) throw new Error("ZALO_APP_SECRET is required");
  if (!zaloRedirectUri) throw new Error("ZALO_REDIRECT_URI is required");
  if (!jwtSecret) throw new Error("APP_JWT_SECRET is required");

  const jwtTtlSeconds = jwtTtlRaw ? Number(jwtTtlRaw) : 3600;
  if (!Number.isFinite(jwtTtlSeconds) || jwtTtlSeconds <= 0) {
    throw new Error("APP_JWT_TTL_SECONDS must be a positive integer");
  }

  return { zaloAppId, zaloAppSecret, zaloRedirectUri, jwtSecret, jwtTtlSeconds };
}

export const ZALO_OAUTH_AUTHORIZE_URL = "https://oauth.zaloapp.com/v4/permission";
export const ZALO_OAUTH_TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token";
export const ZALO_GRAPH_ME_URL = "https://graph.zalo.me/v2.0/me";

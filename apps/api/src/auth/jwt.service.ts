import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthConfig, loadAuthConfig } from "./auth.config";

export type AppJwtPayload = {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class AppJwtService {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.config = loadAuthConfig(configService);
  }

  sign(payload: { sub: string; jti: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtTtlSeconds,
    });
  }

  verify(token: string): AppJwtPayload {
    try {
      return this.jwtService.verify<AppJwtPayload>(token, {
        secret: this.config.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  verifyAllowExpired(token: string): AppJwtPayload {
    try {
      return this.jwtService.verify<AppJwtPayload>(token, {
        secret: this.config.jwtSecret,
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

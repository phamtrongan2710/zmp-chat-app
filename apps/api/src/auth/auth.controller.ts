import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { ZaloCallbackDto } from "./dto/zalo-callback.dto";
import { ZmpLoginDto } from "./dto/zmp-login.dto";
import { JwtAuthGuard, Public } from "./jwt-auth.guard";

type CurrentUserPayload = { id: string; sessionId: string };

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get("zalo/url")
  buildAuthorizeUrl() {
    return this.authService.buildAuthorizeUrl();
  }

  @Public()
  @Post("zalo/callback")
  async handleCallback(@Body() body: ZaloCallbackDto) {
    return this.authService.handleCallback(body.code, body.codeVerifier);
  }

  @Public()
  @Post("zalo/zmp")
  async handleZmpLogin(@Body() body: ZmpLoginDto) {
    return this.authService.handleZmpLogin(body);
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() body: { appJwt?: string }) {
    if (!body?.appJwt) {
      throw new BadRequestException("appJwt is required");
    }
    return this.authService.refresh(body.appJwt);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: CurrentUserPayload) {
    await this.authService.logout(user.sessionId);
    return { ok: true };
  }
}

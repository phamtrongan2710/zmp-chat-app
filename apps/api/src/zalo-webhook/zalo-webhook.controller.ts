import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../auth/jwt-auth.guard";
import { ZaloWebhookService } from "./zalo-webhook.service";

@Controller("webhooks/zalo")
export class ZaloWebhookController {
  constructor(private readonly zaloWebhookService: ZaloWebhookService) {}

  @Public()
  @Post()
  async handleWebhook(@Headers("x-zevent-signature") signature: string, @Body() payload: any) {
    if (!this.zaloWebhookService.verifySignature(payload, signature)) {
      throw new UnauthorizedException("Invalid Zalo signature");
    }

    return this.zaloWebhookService.handleWebhook(payload);
  }
}

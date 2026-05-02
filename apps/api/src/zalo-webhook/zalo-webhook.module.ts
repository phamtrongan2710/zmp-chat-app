import { Module } from "@nestjs/common";
import { ZaloWebhookController } from "./zalo-webhook.controller";
import { ZaloWebhookService } from "./zalo-webhook.service";

@Module({
  controllers: [ZaloWebhookController],
  providers: [ZaloWebhookService],
})
export class ZaloWebhookModule {}

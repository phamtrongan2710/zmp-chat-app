import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VerifySignature } from "zmp-openapi-nodejs";

@Injectable()
export class ZaloWebhookService {
  private readonly logger = new Logger(ZaloWebhookService.name);
  private readonly zaloAPIKey: string;

  constructor(configService: ConfigService) {
    this.zaloAPIKey = configService.get<string>("ZALO_API_KEY") || "";
  }

  verifySignature(payload: any, signature: string): boolean {
    if (!signature || !this.zaloAPIKey || !payload) {
      return false;
    }

    try {
      const generatedSignature = VerifySignature.generateSignature(payload, this.zaloAPIKey);
      return generatedSignature === signature;
    } catch (error) {
      this.logger.error("Error verifying Zalo signature using SDK", error);
      return false;
    }
  }

  async handleWebhook(payload: any) {
    this.logger.log(`Received Zalo webhook: ${JSON.stringify(payload)}`);
    // Handle different event types here
    // Example: if (payload.event === 'oa_send_text') { ... }
    return { success: true };
  }
}

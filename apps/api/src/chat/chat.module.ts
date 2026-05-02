import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}

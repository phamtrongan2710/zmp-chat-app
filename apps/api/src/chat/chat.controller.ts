import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("users")
  async listUsers() {
    return this.chatService.listUsers();
  }

  @Get("bootstrap/:userId")
  async bootstrap(@Param("userId") userId: string) {
    return this.chatService.getBootstrap(userId);
  }

  @Get(":chatId/messages")
  async listMessages(@Param("chatId") chatId: string) {
    return this.chatService.listMessages(chatId);
  }

  @Post("messages")
  async createMessage(@Body() payload: CreateMessageDto) {
    return this.chatService.createMessage(payload);
  }
}

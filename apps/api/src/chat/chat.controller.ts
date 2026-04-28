import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthService } from "../auth/auth.service";
import { ChatService } from "./chat.service";
import { CreateMessageDto } from "./dto/create-message.dto";

type CurrentUserPayload = { id: string; sessionId: string };

@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: CurrentUserPayload) {
    const row = await this.authService.getUserById(user.id);
    return {
      id: row.id,
      name: row.name,
      handle: row.handle,
      avatarLabel: row.avatarLabel,
      avatarUrl: row.avatarUrl,
    };
  }

  @Get("chat/bootstrap")
  async bootstrap(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getBootstrap(user.id);
  }

  @Get("chat/:chatId/messages")
  async listMessages(@Param("chatId") chatId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.listMessagesForUser(chatId, user.id);
  }

  @Post("chat/messages")
  async createMessage(@Body() payload: CreateMessageDto, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.createMessageForUser(payload, user.id);
  }
}

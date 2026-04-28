import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthService } from "../auth/auth.service";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { CreateChatDto } from "./dto/create-chat.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ListMessagesQueryDto } from "./dto/list-messages-query.dto";

type CurrentUserPayload = { id: string; sessionId: string };

@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly chatGateway: ChatGateway,
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

  @Post("chats")
  async createChat(@Body() body: CreateChatDto, @CurrentUser() user: CurrentUserPayload) {
    const result = await this.chatService.createOrGetDirectChat(user.id, body.peerUserId);
    if (result.created) {
      this.chatGateway.emitChatCreated(user.id, body.peerUserId, result.chat);
    }
    return result.chat;
  }

  @Get("chat/:chatId/messages")
  async listMessages(
    @Param("chatId") chatId: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatService.listMessagesPageForUser(chatId, user.id, {
      before: query.before,
      limit: query.limit,
    });
  }

  @Post("chat/messages")
  async createMessage(@Body() payload: CreateMessageDto, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.createMessageForUser(payload, user.id);
  }
}

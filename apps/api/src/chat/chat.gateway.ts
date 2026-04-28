import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { CreateMessageDto } from "./dto/create-message.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { TypingStateDto } from "./dto/typing-state.dto";
import { ChatService } from "./chat.service";

@WebSocketGateway({
  namespace: "chat",
  cors: {
    origin: "*",
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(socket: Socket) {
    const userId = socket.handshake.query.userId;
    if (typeof userId === "string") {
      socket.data.userId = userId;
      const becameOnline = this.chatService.markUserOnline(userId, true);
      socket.emit("presence.snapshot", { onlineUserIds: this.chatService.listOnlineUserIds() });
      if (becameOnline) {
        this.server.emit("presence.updated", { userId, online: true });
      }
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = typeof socket.data.userId === "string" ? socket.data.userId : socket.handshake.query.userId;
    if (typeof userId === "string") {
      const typingUpdates = this.chatService.clearTypingForUser(userId);
      for (const update of typingUpdates) {
        this.server.to(`chat:${update.chatId}`).emit("typing.updated", update);
      }

      const becameOffline = this.chatService.markUserOnline(userId, false);
      if (becameOffline) {
        this.server.emit("presence.updated", { userId, online: false });
      }
    }
  }

  @SubscribeMessage("presence.join")
  handleJoinRoom(@MessageBody() payload: JoinRoomDto, @ConnectedSocket() socket: Socket) {
    socket.join(`chat:${payload.chatId}`);
    return payload;
  }

  @SubscribeMessage("message.create")
  async handleCreateMessage(@MessageBody() payload: CreateMessageDto) {
    const message = await this.chatService.createMessage(payload);
    this.server.to(`chat:${payload.chatId}`).emit("message.created", message);
    return message;
  }

  @SubscribeMessage("typing.update")
  handleTypingUpdate(@MessageBody() payload: TypingStateDto, @ConnectedSocket() socket: Socket) {
    const typingUsers = this.chatService.updateTyping(payload.chatId, payload.userId, payload.isTyping);
    socket.to(`chat:${payload.chatId}`).emit("typing.updated", {
      chatId: payload.chatId,
      typingUsers,
    });
    return { ok: true };
  }
}

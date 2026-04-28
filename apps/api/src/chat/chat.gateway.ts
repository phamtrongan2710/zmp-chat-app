import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Server, Socket } from "socket.io";
import { AppJwtService } from "../auth/jwt.service";
import { PrismaService } from "../database/prisma.service";
import { ChatService } from "./chat.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { TypingStateDto } from "./dto/typing-state.dto";

@WebSocketGateway({
  namespace: "chat",
  cors: {
    origin: "*",
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: AppJwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Authenticate during the handshake so that socket.data.userId is guaranteed
  // to be set before any event handler (or handleConnection) runs. Doing this
  // inside handleConnection races with client emits that arrive immediately
  // after `connect`, surfacing as "Unauthenticated socket" on the first emit.
  afterInit(namespace: Namespace) {
    namespace.use(async (socket, next) => {
      const token = this.readToken(socket);
      if (!token) return next(new Error("Unauthenticated socket"));

      try {
        const payload = this.jwtService.verify(token);
        const session = await this.prisma.session.findUnique({ where: { id: payload.jti } });
        if (!session || session.revokedAt) {
          return next(new Error("Unauthenticated socket"));
        }
        socket.data.userId = payload.sub;
        socket.data.sessionId = payload.jti;
        next();
      } catch {
        next(new Error("Unauthenticated socket"));
      }
    });
  }

  handleConnection(socket: Socket) {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    const becameOnline = this.chatService.markUserOnline(userId, true);
    socket.emit("presence.snapshot", { onlineUserIds: this.chatService.listOnlineUserIds() });
    if (becameOnline) {
      this.server.emit("presence.updated", { userId, online: true });
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = typeof socket.data.userId === "string" ? socket.data.userId : null;
    if (!userId) return;

    const typingUpdates = this.chatService.clearTypingForUser(userId);
    for (const update of typingUpdates) {
      this.server.to(`chat:${update.chatId}`).emit("typing.updated", update);
    }

    const becameOffline = this.chatService.markUserOnline(userId, false);
    if (becameOffline) {
      this.server.emit("presence.updated", { userId, online: false });
    }
  }

  @SubscribeMessage("presence.join")
  async handleJoinRoom(@MessageBody() payload: JoinRoomDto, @ConnectedSocket() socket: Socket) {
    const userId = this.requireUserId(socket);
    if (payload.userId !== userId) return { ok: false };

    await this.chatService.assertParticipant(payload.chatId, userId);
    socket.join(`chat:${payload.chatId}`);
    return { ok: true };
  }

  @SubscribeMessage("message.create")
  async handleCreateMessage(@MessageBody() payload: CreateMessageDto, @ConnectedSocket() socket: Socket) {
    const userId = this.requireUserId(socket);
    const message = await this.chatService.createMessageForUser(payload, userId);
    this.server.to(`chat:${payload.chatId}`).emit("message.created", message);
    return message;
  }

  emitChatCreated(
    creatorUserId: string,
    peerUserId: string,
    chat: { id: string; title: string; participants: unknown[]; messages: unknown[] },
  ) {
    this.server.to(`user:${creatorUserId}`).emit("chat.created", chat);
    const peerView = {
      ...chat,
      title: this.titleForViewer(chat, peerUserId),
    };
    this.server.to(`user:${peerUserId}`).emit("chat.created", peerView);
  }

  private titleForViewer(
    chat: { participants: unknown[] },
    viewerUserId: string,
  ): string {
    const participants = chat.participants as Array<{ id: string; name: string }>;
    const peer = participants.find((participant) => participant.id !== viewerUserId);
    return peer?.name ?? "Direct message";
  }

  @SubscribeMessage("typing.update")
  async handleTypingUpdate(@MessageBody() payload: TypingStateDto, @ConnectedSocket() socket: Socket) {
    const userId = this.requireUserId(socket);
    if (payload.userId !== userId) return { ok: false };

    await this.chatService.assertParticipant(payload.chatId, userId);
    const typingUsers = this.chatService.updateTyping(payload.chatId, payload.userId, payload.isTyping);
    socket.to(`chat:${payload.chatId}`).emit("typing.updated", {
      chatId: payload.chatId,
      typingUsers,
    });
    return { ok: true };
  }

  private readToken(socket: Socket): string | null {
    const auth = (socket.handshake.auth ?? {}) as { token?: unknown };
    if (typeof auth.token === "string" && auth.token.length > 0) return auth.token;

    const header = socket.handshake.headers.authorization;
    if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
      return header.slice("bearer ".length).trim();
    }

    return null;
  }

  private requireUserId(socket: Socket): string {
    const userId = socket.data.userId;
    if (typeof userId !== "string") throw new Error("Unauthenticated socket");
    return userId;
  }
}

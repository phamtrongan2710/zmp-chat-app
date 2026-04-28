# ZMP Chat Sequence Diagrams

This file uses plain-text sequence diagrams so they are readable in any Markdown viewer.

## Legend

```text
A  -> B   request / event / command
A --> B   response / broadcast / callback
{ ... }   local state update
[ ... ]   branch or condition
```

## 1. App Boot And User Restore

```text
Actors: Br=Browser, App=App.tsx, St=chat-store, LS=localStorage, API=REST API

Br         App        St         LS         API
|          |          |          |          |
|--------->|          |          |          |  load app
|          |--------->|          |          |  initialize()
|          |          |-------------------->|  GET /chat/users
|          |          |<--------------------|  availableUsers
|          |          |--------->|          |  readSessionUserId()
|          |          |<---------|          |  userId | null
|          |          |          |          |
|          |          | [userId exists]     |
|          |          |-------------------->|  GET /chat/bootstrap/:userId
|          |          |<--------------------|  { self, chats }
|          |          | { set self/chats/activeChatId }
|          |          |          |          |
|          |          | [userId missing]    |
|          |          | { set isHydrated = true }
```

## 2. Bootstrap Fallback To IndexedDB

```text
Actors: St=chat-store, API=REST API, IDB=IndexedDB

St                    API                  IDB
|                     |                    |
|-------------------->|                    |  GET /chat/bootstrap/:userId
|<--------------------|                    |  success | failure
|                     |                    |
| [success]                                |
| { set self/chats/activeChatId }          |
|----------------------------------------->|  write chat payloads
|                     |                    |
| [failure]                                |
|----------------------------------------->|  read cached chat
|<-----------------------------------------|  cached chat | null
| [cache exists]                           |
| { restore cached chat }                  |
| [cache missing]                          |
| { use demo chat fallback }               |
```

## 3. Socket Connect And Presence Snapshot

```text
Actors: App=App.tsx, WS=socket.io-client, GW=ChatGateway, Svc=ChatService, St=chat-store

App        WS         GW         Svc        St
|          |          |          |          |
|--------->|          |          |          |  connect /chat?userId=...
|          |--------->|          |          |  websocket connection
|          |          |--------->|          |  markUserOnline(userId, true)
|          |          |--------->|          |  listOnlineUserIds()
|          |<---------|          |          |  presence.snapshot
|          |          |          |--------->|  syncPresence() via socket handler
|          |          |          |          |
|          | [if first active connection for that user]
|          |<---------|          |          |  presence.updated(userId, true)
|          |          |----------broadcast----------> other sockets
```

## 4. Join Active Chat Room

```text
Actors: App=App.tsx, St=chat-store, WS=socket.io-client, GW=ChatGateway

App        St         WS         GW
|          |          |          |
| [socket connect]               |
|--------->|          |          |  read activeChatId from store
|---------->---------->|          |  emit presence.join(userId, chatId)
|          |          |--------->|  presence.join
|          |          |          |  socket.join("chat:chatId")
|          |          |          |
| [user switches active chat]    |
|          |--------->|          |  emit presence.join(userId, newChatId)
|          |          |--------->|  presence.join
|          |          |          |  socket.join("chat:newChatId")
```

## 5. Presence Disconnect

```text
Actors: Br=Browser, App=App.tsx, St=chat-store, WS=socket.io-client, GW=ChatGateway, Svc=ChatService

Br         App        St         WS         GW         Svc
|          |          |          |          |          |
|--------->|          |          |          |          |  pagehide / beforeunload
|          |--------->|          |          |          |  sendTyping(false)
|          |--------->|          |          |          |  disconnectRealtime()
|          |          |--------->|          |          |  socket.disconnect()
|          |          |          |--------->|          |  disconnect
|          |          |          |          |--------->|  clearTypingForUser(userId)
|          |          |          |          |--broadcast--> room clients: typing.updated
|          |          |          |          |--------->|  markUserOnline(userId, false)
|          |          |          |          | [if final connection closed]
|          |          |          |          |--broadcast--> all clients: presence.updated(false)
```

## 6. Typing Start / Stop

```text
Actors: UI=Composer, St=chat-store, WS=socket.io-client, GW=ChatGateway, Svc=ChatService, Peer=peer store/UI

UI         St         WS         GW         Svc        Peer
|          |          |          |          |          |
|--------->|          |          |          |          |  draft changes
|          |          |          |          |          |
| [draft.trim().length > 0]
|--------->|          |          |          |          |  sendTyping(true)
|          |--------->|          |          |          |  typing.update(chatId, userId, true)
|          |          |--------->|          |          |  typing.update
|          |          |          |--------->|          |  updateTyping(..., true)
|          |          |          |<---------|          |  typingUsers[]
|          |          |          |-------------------->|  typing.updated(chatId, typingUsers)
|          |          |          |          |          |  render typing placeholder
|          |          |          |          |          |
| [draft becomes empty]
|--------->|          |          |          |          |  sendTyping(false)
|          |--------->|          |          |          |  typing.update(..., false)
|          |          |--------->|          |          |
|          |          |          |--------->|          |  updateTyping(..., false)
|          |          |          |<---------|          |  typingUsers[]
|          |          |          |-------------------->|  typing.updated(chatId, typingUsers)
|          |          |          |          |          |  remove typing placeholder
```

## 7. Typing Cleanup On Disconnect

```text
Actors: WS=disconnecting socket, GW=ChatGateway, Svc=ChatService, Peer=peer store/UI

WS         GW         Svc        Peer
|          |          |          |
|--------->|          |          |  disconnect
|          |--------->|          |  clearTypingForUser(userId)
|          |<---------|          |  affected chats + typingUsers[]
|          | [for each affected chat]
|          |-------------------->|  typing.updated(chatId, typingUsers)
|          |          |          |  remove user from typing list
|          |          |          |  remove typing placeholder
```

## 8. Message Send With Optimistic UI

```text
Actors: UI=Composer, St=sender store, IDB=IndexedDB, WS=socket, GW=ChatGateway, Svc=ChatService, DB=Prisma/Postgres, Peer=receiver store/UI

UI         St         IDB        WS         GW         Svc        DB         Peer
|          |          |          |          |          |          |          |
|--------->|          |          |          |          |          |          |  submit message
|          | { create optimistic message, status="sent" }        |          |
|          |---------->|          |          |          |          |          |  write updated chat
|          |---------->---------->|          |          |          |          |  message.create(message)
|          |          |          |--------->|          |          |          |  message.create
|          |          |          |          |--------->|          |          |  createMessage(payload)
|          |          |          |          |          |--------->|          |  upsert message
|          |          |          |          |          |<---------|          |  saved message
|          |          |          |          |<---------|          |          |  message(status=sent|delivered)
|          |          |          |<---------|          |          |          |  message.created
|          | { reconcile optimistic message status }   |          |          |
|          |---------->|          |          |          |          |          |  write reconciled chat
|          |          |          |          |------------------------------->|  message.created to peer room
|          |          |          |          |          |          |          |  append or reconcile message
```

## 9. HTTP Bootstrap Data Assembly

```text
Actors: St=chat-store, Ctrl=ChatController, Svc=ChatService, DB=Prisma/Postgres

St         Ctrl       Svc        DB
|          |          |          |
|--------->|          |          |  GET /chat/bootstrap/:userId
|          |--------->|          |  getBootstrap(userId)
|          |          |--------->|  find users
|          |          |<---------|  users
|          |          |--------->|  find chats for user
|          |          |<---------|  chats + participants + messages
|          |          | { map DB rows to API payload }
|          |<---------|          |  { self, chats }
|<---------|          |          |  bootstrap payload
```

## 10. API Startup Seed

```text
Actors: Nest=Nest app, Prisma=PrismaService, DB=PostgreSQL

Nest       Prisma     DB
|          |          |
|--------->|          |  onModuleInit()
|          |--------->|  connect
|          |--------->|  upsert users
|          |--------->|  upsert chat
|          |--------->|  upsert chat participants
|          |--------->|  upsert seed message
|          | { database ready for local demo flow }
```

## Event Reference

### HTTP

- `GET /chat/users`
- `GET /chat/bootstrap/:userId`
- `GET /chat/:chatId/messages`
- `POST /chat/messages`

### Socket

- `presence.join`
- `presence.updated`
- `presence.snapshot`
- `typing.update`
- `typing.updated`
- `message.create`
- `message.created`

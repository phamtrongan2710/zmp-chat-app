# ZMP Chat Data Flows

This document describes the main runtime data flows in the project.

## Scope

- Frontend: React app in `apps/web`
- Frontend state: Zustand store in `apps/web/src/store/chat-store.ts`
- Frontend local persistence: session storage + IndexedDB
- Backend HTTP + websocket: NestJS app in `apps/api`
- Backend persistence: Prisma + PostgreSQL

## Main Runtime Pieces

### Frontend

- `apps/web/src/App.tsx`
  Owns app boot, socket lifecycle, socket event subscriptions, and page teardown behavior.
- `apps/web/src/store/chat-store.ts`
  Central client state for current user, chats, presence, typing, socket reference, and message actions.
- `apps/web/src/components/chat/auth-screen.tsx`
  Lets the user pick one of the demo accounts.
- `apps/web/src/components/chat/chat-sidebar.tsx`
  Renders chat list and active chat selection.
- `apps/web/src/components/chat/conversation-view.tsx`
  Renders messages, peer presence, and typing placeholder bubble.
- `apps/web/src/components/chat/composer.tsx`
  Sends draft updates and message submissions.
- `apps/web/src/lib/session.ts`
  Stores current selected user in `localStorage`.
- `apps/web/src/lib/indexeddb.ts`
  Stores per-user chat payloads in IndexedDB for local fallback.

### Backend

- `apps/api/src/main.ts`
  Boots NestJS with validation.
- `apps/api/src/app.module.ts`
  Wires config, database, and chat modules.
- `apps/api/src/database/prisma.service.ts`
  Prisma client, DB connection, and seed bootstrap.
- `apps/api/src/chat/chat.controller.ts`
  HTTP endpoints for users, bootstrap payload, messages.
- `apps/api/src/chat/chat.gateway.ts`
  Socket.IO gateway for presence, typing, and realtime messages.
- `apps/api/src/chat/chat.service.ts`
  Domain logic for users, chats, messages, presence, typing state.

## Data Model

Prisma schema lives in `apps/api/prisma/schema.prisma`.

Main tables:

- `users`
- `chats`
- `chat_participants`
- `messages`

Transient in-memory backend state:

- online user connection counts
- typing users per chat

Transient in-memory frontend state:

- authenticated local demo user
- available users
- chat list
- active chat id
- typing users by chat
- live socket instance

## Flow 1: App Boot And Session Restore

### Inputs

- browser loads frontend app
- `localStorage` may contain selected user id

### Flow

1. `App.tsx` mounts.
2. `initialize()` runs from the Zustand store.
3. Frontend requests `GET /chat/users`.
4. If API succeeds, `availableUsers` is replaced with backend data.
5. Frontend reads `localStorage` through `readSessionUserId()`.
6. If a user id exists, `selectUser(userId)` runs.
7. If no user id exists, app remains on the account picker.

### Outputs

- hydrated account picker, or
- restored chat session for the selected user

## Flow 2: User Selection And Chat Bootstrap

### Trigger

- user selects a demo account

### Flow

1. `selectUser(userId)` writes the selected id into `localStorage`.
2. Store resets temporary UI state like typing map.
3. `hydrate()` requests `GET /chat/bootstrap/:userId`.
4. Backend `ChatController.bootstrap()` calls `ChatService.getBootstrap(userId)`.
5. `ChatService` loads:
   - all users
   - chats involving the current user
   - participants for each chat
   - ordered messages for each chat
6. Backend returns `{ self, chats }`.
7. Frontend stores:
   - `selfUserId`
   - `selfUser`
   - `chats`
   - `activeChatId`
8. Frontend writes each chat payload into IndexedDB using key `${selfUserId}:${chatId}`.

### Fallback Path

If backend bootstrap fails:

1. Frontend tries IndexedDB cache.
2. If cache exists, it restores that chat payload.
3. If cache does not exist, it falls back to the in-memory demo chat.

## Flow 3: Socket Connection Lifecycle

### Trigger

- `selfUserId` becomes available in the app

### Flow

1. `App.tsx` creates a Socket.IO client for namespace `/chat`.
2. Query includes `userId`.
3. Backend `ChatGateway.handleConnection()` runs.
4. Backend:
   - stores the connected user id on the socket
   - increments online connection count
   - emits `presence.snapshot` to the connecting socket
   - emits `presence.updated` globally if the user just became online
5. Frontend subscribes to:
   - `message.created`
   - `presence.updated`
   - `presence.snapshot`
   - `typing.updated`
6. On socket `connect`, frontend emits `presence.join` for the active chat room.
7. When the active chat changes, frontend emits `presence.join` again for the new chat room.

### Teardown

On page unload / page hide / app cleanup:

1. Frontend sends `typing=false`.
2. Frontend disconnects socket.
3. Backend `handleDisconnect()`:
   - clears typing state for that user from all chats
   - emits `typing.updated` for affected rooms
   - decrements online connection count
   - emits `presence.updated` if the user became fully offline

## Flow 4: Presence Updates

### Source Of Truth

- backend websocket events

### Backend Logic

- online state is tracked in memory as a connection count per user
- first active connection makes the user online
- final disconnect makes the user offline

### Event Flow

1. User connects.
2. Backend emits:
   - `presence.snapshot` to the new socket
   - `presence.updated { userId, online: true }` if newly online
3. Frontend store receives snapshot and updates:
   - chat participants
   - self user
   - available users
4. Frontend store receives incremental updates and patches the same structures.

### UI Consumption

- `auth-screen.tsx` uses `availableUsers`
- `conversation-view.tsx` reads peer `online`

## Flow 5: Typing State

### Source Of Truth

- frontend draft content decides whether current user is typing
- backend broadcasts typing state to the peer

### Frontend Outbound Logic

`Composer` sends:

- `typing=true` when `draft.trim().length > 0`
- `typing=false` when:
  - draft becomes empty
  - message is submitted
  - component unmounts
  - page/session is closing

### Backend Logic

1. Gateway receives `typing.update`.
2. `ChatService.updateTyping(chatId, userId, isTyping)` mutates in-memory typing state.
3. Gateway emits `typing.updated` to other sockets in the room.

### Disconnect Safety

If a browser closes while still typing:

1. `handleDisconnect()` calls `clearTypingForUser(userId)`.
2. Backend emits `typing.updated` with the cleaned typing list.

### UI Consumption

- `conversation-view.tsx` computes `peerIsTyping`
- header status shows `typing...`
- typing placeholder bubble is appended to the message list while `peerIsTyping` is true

## Flow 6: Message Send

### Trigger

- current user submits the composer form

### Frontend Flow

1. `Composer.onSubmit()` captures current draft.
2. Draft input is cleared.
3. `typing=false` is emitted.
4. `sendMessage(content)` runs in the store.
5. Store creates optimistic message with:
   - `id = crypto.randomUUID()`
   - `chatId`
   - `senderId`
   - `content`
   - `createdAt`
   - initial `status = "sent"`
6. Frontend appends the optimistic message to the active chat.
7. Frontend writes updated chat to IndexedDB.
8. Frontend emits `message.create` over websocket.

### Backend Flow

1. Gateway receives `message.create`.
2. `ChatService.createMessage(payload)` checks whether peer is online.
3. Backend sets final message status:
   - `delivered` if peer is online
   - `sent` otherwise
4. Prisma upserts the message into PostgreSQL.
5. Gateway emits `message.created` to the chat room.

### Frontend Reconciliation

1. Both participants receive `message.created`.
2. Store `receiveMessage()`:
   - updates matching optimistic message status if ids match, or
   - appends the message if it is new
3. Frontend writes final chat payload to IndexedDB.

## Flow 7: Chat Selection

### Trigger

- user clicks a chat in the sidebar

### Flow

1. `setActiveChat(chatId)` updates `activeChatId`.
2. Store emits `presence.join` immediately if socket exists.
3. `App.tsx` join effect also emits `presence.join` for the active chat.
4. Socket joins room `chat:${chatId}` on backend.

### Result

- subsequent `message.created` and `typing.updated` events for that chat reach the socket room

## Flow 8: Local Persistence

### Session Persistence

- key: selected user id in `localStorage`
- purpose: restore which demo account was last selected

### Chat Cache Persistence

- storage: IndexedDB
- key format: `${selfUserId}:${chatId}`
- payload: serialized `Chat`

### Write Points

- after successful bootstrap
- after optimistic local send
- after message reconciliation from socket events

### Read Point

- bootstrap fallback when API is unavailable

## Flow 9: Database Bootstrap

### Trigger

- API startup

### Flow

1. `PrismaService` loads `DATABASE_URL`.
2. Prisma client connects.

### Result

- empty database; users are created on demand by the Zalo OAuth callback

## Boundaries And Source Of Truth

### Backend Is Source Of Truth For

- persisted users
- chats
- chat membership
- messages
- realtime presence snapshot
- realtime typing broadcast

### Frontend Is Source Of Truth For

- current local draft content
- selected active chat
- optimistic message insertion before server confirmation
- cached offline fallback payloads

### Transient Shared Contract

Socket events:

- `presence.join`
- `presence.updated`
- `presence.snapshot`
- `typing.update`
- `typing.updated`
- `message.create`
- `message.created`

HTTP endpoints:

- `GET /chat/users`
- `GET /chat/bootstrap/:userId`
- `GET /chat/:chatId/messages`
- `POST /chat/messages`

## Known Simplifications

- account selection is local, not authenticated
- presence and typing are in-memory on the backend
- app currently assumes a simple 1:1 chat seed
- websocket room membership is lightweight and not persisted


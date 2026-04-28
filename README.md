# ZMP Chat

Local-first two-user realtime chat scaffold with a Telegram-like UI.

## Stack

- Frontend: React, Zustand, IndexedDB, shadcn-style UI structure
- Backend: NestJS, Socket.IO, Prisma + PostgreSQL local backend
- Local services: Docker Compose for PostgreSQL
- Local TLS: Windows PowerShell script for a localhost dev certificate

## Project Layout

- `apps/web`: React client
- `apps/api`: NestJS API and websocket gateway

## Current Features

- Telegram-style layout with chat list, active conversation, message composer
- Two local demo accounts with quick account switching
- Zustand store with IndexedDB persistence for local message cache
- NestJS REST + Socket.IO backend with Prisma-backed users, chat membership, and messages
- Presence, typing state, and message delivery status in the 1:1 chat flow
- Automatic Prisma client generation, schema sync, and seed data for local Postgres

## Run Plan

Install dependencies once package manifests are reviewed:

```bash
npm install
```

Start PostgreSQL locally:

```bash
docker compose up -d
```

Generate the local HTTPS certificate:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-dev-cert.ps1
```

Copy the API environment file:

```bash
copy apps\\api\\.env.example apps\\api\\.env
```

Run backend:

```bash
npm run dev:api
```

Run frontend:

```bash
npm run dev:web
```

Local URLs:

```text
API: https://localhost:3000
Web: https://localhost:5173
```

Prisma helpers:

```bash
npm --workspace @zmp-chat/api run prisma:generate
npm --workspace @zmp-chat/api run prisma:push
```

## Next Iteration

- Replace the demo account picker with proper auth/session handling
- Add unread counters and read receipts
- Add message pagination and retry handling

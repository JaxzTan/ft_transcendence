# Notification Module

## Table of Contents

- [Overview](#overview) — Real-time notifications via SSE + Redis pub/sub
- [Files](#files) — Source file inventory
- [Key Types / Interfaces](#key-types--interfaces) — NotificationType, NotificationPayload
- [API Endpoints](#api-endpoints) — REST + SSE routes
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagram of notify → SSE delivery
- [Logic Paths Summary](#logic-paths-summary) — Decision trees
- [Dependencies](#dependencies) — Internal and external dependencies

---

## Overview

The Notification module delivers real-time, persisted notifications to users. It combines two mechanisms:

1. **Persistence** — every notification is written to the `Notification` table (PostgreSQL), so missed notifications appear in the bell dropdown on next page load.
2. **Real-time push** — a Server-Sent Events (SSE) stream (`/api/notifications/stream`) delivers new notifications instantly to open tabs, bridged via Redis Pub/Sub.

Notification types: `friend_request`, `friend_accepted`, `game_invite`, `achievement`.

> The module is imported by `FriendsModule`, `MatchModule`, and `AchievementsModule`, which inject `NotificationService` and call `notify()`. It exports `NotificationService` so any module can send a notification.

---

## Files

| File | Role |
|------|------|
| `notification.controller.ts` | HTTP routes: SSE stream, list unread, mark read / all read |
| `notification.service.ts` | Redis pub/sub bridging, per-user SSE Subjects, persistence, `notify()` helper |
| `notification.module.ts` | NestJS module — registers controller/service, exports `NotificationService` |

---

## Key Types / Interfaces

### NotificationType

```typescript
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invite'
  | 'achievement';
```

### NotificationPayload

```typescript
export interface NotificationPayload {
  id: string;  // Unique ID
  type: NotificationType;  // Type of notification
  payload: Record<string, unknown>; // per-type data (e.g. { fromUsername, gameId, ... })
  read: boolean;  // Whether it has been read
  createdAt: string; // ISO string
}
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/notifications/stream` | JWT | SSE stream — pushes new notifications in real time |
| `GET` | `/api/notifications` | JWT | List unread notifications (for the bell dropdown on load) |
| `PATCH` | `/api/notifications/:id/read` | JWT | Mark one notification read |
| `POST` | `/api/notifications/read-all` | JWT | Mark all notifications read |

---

## Core Logic / Flow

### 1. Notify → SSE Delivery

Sequence of steps when any service calls `notificationService.notify(userId, type, payload)`.
```mermaid
sequenceDiagram
    participant App as Any part of the backend
    participant Notify as NotificationService
    participant DB as Database
    participant Stream as Live message stream

    App->>Notify: Send a notification (userId, type, payload)
    Notify->>DB: Save the notification
    Notify->>Stream: Push it to that user's live stream
    Stream-->>User's Browser: The notification pops up instantly
```

### 2. SSE Subscribe

When a client opens `/api/notifications/stream`, the service creates an rxjs `Subject`, adds it to a per-user array (supporting multiple tabs), and — on first tab for a user — subscribes to `notify:<userId>` on Redis. Closing the last tab unsubscribes.

---

## Logic Paths Summary

### Open SSE Stream
```
GET /api/notifications/stream (JWT)
  ├── Look up in-memory clients map for userId
  │   ├── First tab → subscribe to notify:<userId> on Redis
  │   └── Existing → append Subject to the user's array
  └── Pipe Subject into SSE response; push each event as a data frame
```

### List Unread / Mark Read
```
GET /api/notifications (JWT)
  └── notification.findMany({ userId, read: false }, take 50, by createdAt desc)

PATCH /api/notifications/:id/read (JWT)
  └── notification.updateMany({ id, userId }, { read: true })

POST /api/notifications/read-all (JWT)
  └── notification.updateMany({ userId, read: false }, { read: true })
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `PrismaService` | Persist notifications (Notification model) |
| `ioredis` | Pub/Sub bridging (publish + subscribe) |
| `@nestjs/sse` via `@Sse` decorator | SSE stream controller |
| `rxjs` | Observable/Subject streaming |
| `secrets.ts` | Redis password (`REDIS_PASSWORD`) |
| `JwtAuthGuard` | Protects all notification endpoints |

---

## Configuration / Environment

| Variable | Default | Used By |
|----------|---------|---------|
| `REDIS_HOST` | `redis` | Pub/Sub connection |
| `REDIS_PORT` | `6479` | Pub/Sub connection |
| `REDIS_PASSWORD` | (from secrets) | Redis authentication |

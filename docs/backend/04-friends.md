# Friends Module

## Table of Contents

- [Overview](#overview) — Friend request lifecycle and relationship management
- [Files](#files) — Every source file in the module and its role
- [Key Types / Interfaces](#key-types--interfaces) — Friendship status enum and response shapes
- [API Endpoints](#api-endpoints) — All 7 routes with method, path, auth, and description
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagrams for send, accept, decline, list, requests, remove, and block
- [Logic Paths Summary](#logic-paths-summary) — Decision trees for each operation
- [Dependencies](#dependencies) — Internal services this module relies on

---

## Overview

The Friends module manages the friendship lifecycle between users. It supports:

1. **Friend requests** — send a request to another user.
2. **Accept/Decline** — the recipient can accept or decline a pending request.
3. **Listing** — view all friends with their rating and friendsSince date.
4. **Pending requests** — view sent and received pending requests.
5. **Removal** — remove a friend.
6. **Blocking** — block a user.

Friendships have a status field: `pending`, `accepted`, or `blocked`.

---

## Files

| File | Role |
|------|------|
| `friends.controller.ts` | HTTP routes: send, accept, decline, list, requests, remove, block |
| `friends.service.ts` | Business logic: Prisma queries for friendship CRUD |
| `friends.module.ts` | NestJS module — registers controller, service, and PrismaService |

---

## Key Types / Interfaces

### FriendshipStatus Enum

```prisma
enum FriendshipStatus {
  pending    // Request sent, awaiting response
  accepted   // Both users are friends
  blocked    // User has blocked the other
}
```

### Friendship Model

```typescript
{
  id: string;        // Composite ID (e.g. "userId-friendId")
  userId: string;    // User who initiated
  friendId: string;  // Target user
  status: FriendshipStatus;
  createdAt: Date;
}
```

### Friends List Response Shape

```typescript
{
  id: string;
  username: string;
  avatarStyle: string | null;
  rating: number;
  friendsSince: Date;
}
```

### Friend Requests Response Shape

```typescript
{
  sent: Array<{
    id: string;
    userId: string;
    username: string;
    avatarStyle: string | null;
    createdAt: Date;
  }>;
  received: Array<{
    id: string;
    userId: string;
    username: string;
    avatarStyle: string | null;
    createdAt: Date;
  }>;
}
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/friends/request/:userId` | JWT | Send friend request to target user |
| `POST` | `/api/friends/accept/:requestId` | JWT | Accept a pending friend request |
| `POST` | `/api/friends/decline/:requestId` | JWT | Decline a pending friend request |
| `DELETE` | `/api/friends/remove/:friendId` | JWT | Remove a friend by friend's user ID |
| `GET` | `/api/friends` | JWT | List all friends with rating and friendsSince |
| `GET` | `/api/friends/requests` | JWT | List pending sent and received requests |
| `POST` | `/api/friends/block/:userId` | JWT | Block a user |

---

## Core Logic / Flow

### 1. Send Friend Request

Sequence of steps when a user sends a friend request to another user.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: POST /api/friends/request/{userId}
    Controller->>Service: sendFriendRequest(senderId, targetUserId)
    alt Target is self
        Service-->>Controller: throw BadRequestException
        Controller-->>Client: 400 Bad Request
    end
    Service->>Prisma: user.findUnique({ id: targetUserId })
    alt Target not found
        Service-->>Controller: throw NotFoundException
        Controller-->>Client: 404 Not Found
    end
    Service->>Prisma: Check existing friendship
    alt Already accepted
        Service-->>Controller: throw BadRequestException
        Controller-->>Client: 400 Already friends
    else Already pending
        Service-->>Controller: throw BadRequestException
        Controller-->>Client: 400 Request already pending
    else Blocked
        Service-->>Controller: throw ForbiddenException
        Controller-->>Client: 403 Blocked
    end
    Service->>Prisma: friendship.create({ userId, friendId, status: 'pending' })
    Prisma-->>Service: created friendship (with user/friend relations)
    Service-->>Controller: friendship object
    Controller-->>Client: 201 (friendship object)
```

### 2. Accept Friend Request

Sequence of steps when a user accepts a pending friend request.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: POST /api/friends/accept/{requestId}
    Controller->>Service: acceptFriendRequest(requestId, userId)
    Service->>Prisma: friendship.findFirst({ id: requestId, friendId: userId, status: 'pending' })
    alt Not found
        Service-->>Controller: throw NotFoundException
        Controller-->>Client: 404 Not Found
    end
    Service->>Prisma: friendship.update({ status: 'accepted' })
    Prisma-->>Service: updated friendship (with relations)
    Service-->>Controller: updated friendship object
    Controller-->>Client: 200 (friendship object)
```

### 3. Decline Friend Request

Sequence of steps when a user declines a pending friend request.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: POST /api/friends/decline/{requestId}
    Controller->>Service: declineFriendRequest(requestId, userId)
    Service->>Prisma: friendship.findFirst({ id: requestId, friendId: userId, status: 'pending' })
    alt Not found
        Service-->>Controller: throw NotFoundException
        Controller-->>Client: 404 Not Found
    end
    Service->>Prisma: friendship.delete({ id: requestId })
    Service-->>Controller: { message: 'Friend request declined' }
    Controller-->>Client: 200 { message: 'Friend request declined' }
```

### 4. List Friends

Sequence of steps when a user lists their friends.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: GET /api/friends
    Controller->>Service: getFriends(userId)
    Service->>Prisma: Find friendships where userId or friendId matches, status = 'accepted'
    Prisma-->>Service: [friendships with user/friend relations]
    Service->>Service: Map to { id, username, avatarStyle, rating, friendsSince }
    Service-->>Controller: [{ id, username, avatarStyle, rating, friendsSince }]
    Controller-->>Client: 200 [{ id, username, ... }]
```

### 5. Remove Friend

Sequence of steps when a user removes a friend.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: DELETE /api/friends/remove/{friendId}
    Controller->>Service: removeFriend(userId, friendId)
    Service->>Prisma: Find friendship where (userId, friendId) or (friendId, userId), status = 'accepted'
    alt Not found
        Service-->>Controller: throw NotFoundException
        Controller-->>Client: 404 Not Found
    end
    Service->>Prisma: friendship.delete({ id })
    Service-->>Controller: { message: 'Friend removed' }
    Controller-->>Client: 200 { message: 'Friend removed' }
```

### 6. Block User

Sequence of steps when a user blocks another user.
```mermaid
sequenceDiagram
    participant Client
    participant Controller as FriendsController
    participant Service as FriendsService
    participant Prisma

    Client->>Controller: POST /api/friends/block/{userId}
    Controller->>Service: blockUser(userId, targetUserId)
    alt Target is self
        Service-->>Controller: throw BadRequestException
        Controller-->>Client: 400 Bad Request
    end
    Service->>Prisma: Find existing friendship
    alt Existing found
        Service->>Prisma: friendship.update({ status: 'blocked' })
    else No existing
        Service->>Prisma: friendship.create({ userId, friendId, status: 'blocked' })
    end
    Prisma-->>Service: blocked friendship (with relations)
    Service-->>Controller: friendship object
    Controller-->>Client: 200 (friendship object)
```

---

## Logic Paths Summary

### Send Friend Request Path
```
POST /api/friends/request/{userId} (JWT required)
  ├── Check target is self → 400 Bad Request
  ├── Check target exists → 404 Not Found
  ├── Check existing friendship:
  │   ├── Accepted → 400 Already friends
  │   ├── Pending → 400 Request already pending
  │   └── Blocked → 403 Cannot send
  ├── friendship.create({ userId, friendId, status: 'pending' })
  └── 201 (friendship object)
```

### Accept Friend Request Path
```
POST /api/friends/accept/{requestId} (JWT required)
  ├── friendship.findFirst({ id, friendId: userId, status: 'pending' }) → 404 Not Found
  ├── friendship.update({ status: 'accepted' })
  └── 200 (friendship object)
```

### Decline Friend Request Path
```
POST /api/friends/decline/{requestId} (JWT required)
  ├── friendship.findFirst({ id, friendId: userId, status: 'pending' }) → 404 Not Found
  ├── friendship.delete({ id })
  └── 200 { message: 'Friend request declined' }
```

### List Friends Path
```
GET /api/friends (JWT required)
  ├── Find friendships where userId or friendId matches, status = 'accepted'
  ├── Map to { id, username, avatarStyle, rating, friendsSince }
  └── 200 [{ id, username, avatarStyle, rating, friendsSince }]
```

### Remove Friend Path
```
DELETE /api/friends/remove/{friendId} (JWT required)
  ├── Find friendship by (userId, friendId) or (friendId, userId), status = 'accepted' → 404 Not Found
  ├── friendship.delete()
  └── 200 { message: 'Friend removed' }
```

### Block User Path
```
POST /api/friends/block/{userId} (JWT required)
  ├── Check target is self → 400 Bad Request
  ├── Find existing friendship:
  │   ├── Found → update status to 'blocked'
  │   └── Not found → create new with status 'blocked'
  └── 200 (friendship object)
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `PrismaService` | Database access (Friendship, User models) |
| `JwtAuthGuard` | Protects all friend endpoints |
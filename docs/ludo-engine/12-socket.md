# Ludo Engine — Socket Layer

## Table of Contents

- [Overview](#overview) — Socket.IO server, client event handling, and Redis pub/sub integration
- [Files](#files) — Every source file in the module and its role
- [Key Types / Interfaces](#key-types--interfaces) — Socket data types and event names
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagrams for connection, event handling, and Redis broadcasting
- [Logic Paths Summary](#logic-paths-summary) — Decision trees for each operation
- [Dependencies](#dependencies) — Internal and external dependencies

---

## Overview

The Socket Layer is the communication backbone of the Ludo Engine. It provides:

1. **Socket.IO server** — handles real-time bidirectional communication between clients and the game engine.
2. **JWT authentication** — validates socket connections using the same JWT token from the NestJS backend.
3. **Event handling** — processes client events like `join_game`, `roll_dice`, `move_piece`, `clash_input`, etc.
4. **Redis pub/sub** — publishes game events to Redis channels and subscribes for multi-instance broadcasting.
5. **Result submission** — sends game results to the NestJS backend API via HTTP.

---

## Files

| File | Role |
|------|------|
| `server.ts` | SocketServer class — orchestrates the engine, Redis, Socket.IO, bot management, rematch voting, lobby expiry |
| `socket-handlers.ts` | SocketHandlers class — handlers for join_game, roll_dice, move_piece, clash_input, player_ready, select_color, leave_game, etc. |
| `auth.ts` | JWT token verification, SocketData interface, GameSocket type, requirePlayer helper, constants |
| `event-publisher.ts` | EventPublisher class — publishes game lifecycle events to Redis pub/sub |
| `redis-broadcaster.ts` | RedisBroadcaster class — subscribes to game:* Redis channels and forwards to Socket.IO rooms |
| `result-submitter.ts` | ResultSubmitter class — submits game results to backend API via HTTP POST with engine API key |

---

## Key Types / Interfaces

### GameSocket

```typescript
interface SocketData {
  userId: string;
  username: string;
}

type GameSocket = Socket<ClientEvents, ServerEvents, any, SocketData>;
```

### Event Names

**Client → Server:**
- `join_game` — Join a game room
- `roll_dice` — Roll the dice
- `move_piece` — Move a piece
- `clash_input` — Respond to a clash
- `player_ready` — Mark as ready
- `select_color` — Select a color
- `leave_game` — Leave the game
- `rematch_vote` — Vote for rematch

**Server → Client:**
- `state_update` — Full game state update
- `dice_rolled` — Dice result
- `piece_moved` — Piece movement
- `clash_start` — Clash minigame started
- `clash_result` — Clash minigame result
- `game_ended` — Game over
- `lobby_update` — Lobby state change
- `error` — Error message

---

## Core Logic / Flow

### 1. Socket Connection & Authentication

Sequence of steps when a client connects to the Socket.IO server.
```mermaid
sequenceDiagram
    participant Client
    participant Server as SocketServer
    participant Auth as auth.ts
    participant Engine as LudoEngine
    participant Redis as EventPublisher

    Client->>Server: connect(socket, { auth: { token } })
    Server->>Auth: verifyToken(token)
    alt Invalid token
        Auth-->>Server: null
        Server-->>Client: disconnect (401)
    else Valid token
        Auth-->>Server: { userId, username }
        Server->>Server: Attach user data to socket
        Server-->>Client: connected (authenticated)
    end
```

### 2. Game Event Flow (Roll Dice Example)

Sequence of steps when a client rolls the dice.
```mermaid
sequenceDiagram
    participant Client
    participant Server as SocketServer
    participant Handler as SocketHandlers
    participant Engine as LudoEngine
    participant Publisher as EventPublisher
    participant Broadcaster as RedisBroadcaster

    Client->>Server: roll_dice
    Server->>Handler: handleRollDice(socket, data)
    Handler->>Handler: requirePlayer(socket) → verify authenticated
    Handler->>Engine: rollDice(gameId, playerColor)
    Engine-->>Handler: { diceValue, legalMoves }
    Handler->>Publisher: publish('dice_rolled', { gameId, player, value })
    Publisher->>Redis: PUBLISH game:{gameId} { type: 'dice_rolled', ... }
    Handler-->>Client: dice_rolled { value, legalMoves }
    Note over Broadcaster: Other instances receive via Redis pub/sub
    Broadcaster->>Redis: SUBSCRIBE game:{gameId}
    Redis-->>Broadcaster: message
    Broadcaster->>Server: io.to(gameId).emit('state_update', data)
    Server-->>OtherClients: state_update
```

### 3. Game End & Result Submission

Sequence of steps when a game ends.
```mermaid
sequenceDiagram
    participant Engine as LudoEngine
    participant Handler as SocketHandlers
    participant Submitter as ResultSubmitter
    participant Backend as NestJS API
    participant Publisher as EventPublisher

    Engine->>Handler: game_ended event
    Handler->>Submitter: submitResult(gameState)
    Submitter->>Submitter: Build payload (gameId, gameType, participants)
    Submitter->>Backend: POST /api/game/end (with engine API key)
    alt Success
        Backend-->>Submitter: 200 { message: 'Game result recorded' }
        Submitter-->>Handler: result submitted
    else Error
        Backend-->>Submitter: 4xx/5xx
        Submitter-->>Handler: error (retry logic)
    end
    Handler->>Publisher: publish('game_ended', { gameId, winner })
    Handler-->>Client: game_ended { winner, stats }
```

### 4. Redis Broadcasting

Sequence of steps showing how game state is broadcast across multiple engine instances.
```mermaid
sequenceDiagram
    participant EngineA as Engine Instance A
    participant PubA as EventPublisher (A)
    participant Redis as Redis Server
    participant BroadB as RedisBroadcaster (B)
    participant RoomB as Socket.IO Room (B)

    EngineA->>PubA: publish('piece_moved', { gameId, ... })
    PubA->>Redis: PUBLISH game:{gameId} { type: 'piece_moved', ... }
    Note over Redis: Redis pub/sub channels: game:{gameId}

    Note over BroadB: Engine Instance B subscribes
    Redis-->>BroadB: MESSAGE game:{gameId}
    BroadB->>BroadB: Parse message
    BroadB->>RoomB: io.to(gameId).emit('state_update', data)
    RoomB-->>ClientsB: state_update
```

---

## Logic Paths Summary

### Connection Path
```
connect(socket, { auth: { token } })
  ├── verifyToken(token)
  │   ├── Invalid → disconnect (401)
  │   └── Valid → attach { userId, username } to socket.data
  └── Connection established
```

### Event Handler Path (Generic)
```
socket.on('{event}', data)
  ├── requirePlayer(socket) → verify authenticated
  ├── Execute handler (e.g., rollDice, movePiece)
  ├── Publish event to Redis pub/sub
  └── Emit result back to client
```

### Game End Path
```
game_ended detected
  ├── Build result payload (gameId, gameType, participants)
  ├── POST /api/game/end (with engine API key)
  │   ├── 200 → success
  │   └── Error → retry
  ├── Publish game_ended event to Redis
  └── Emit game_ended to all players in room
```

### Redis Broadcast Path
```
Redis PUBLISH game:{gameId} { type, data }
  └── All subscribed instances:
      ├── Parse message
      └── io.to(gameId).emit('state_update', data)
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `socket.io` | Real-time WebSocket communication |
| `ioredis` | Redis client for pub/sub and data storage |
| `jsonwebtoken` | JWT verification for socket authentication |
| `axios` | HTTP client for submitting game results to backend |
| `LudoEngine` | Core game logic |
| `LobbyManager` | Pre-game lobby management |
| `ClashManager` | Clash minigame management |
| `RedisGameStore` | Persistence layer for game state |

---

## Configuration / Environment

| Variable | Default | Used By |
|----------|---------|---------|
| `JWT_SECRET` | (from env) | Socket auth token verification |
| `ENGINE_API_KEY` | (from env) | Result submission to backend |
| `BACKEND_URL` | `http://backend:3000` | Result submission target URL |
| `REDIS_URL` | (from env) | Redis connection for pub/sub |
| `PORT` | `3001` | Socket.IO server listen port |
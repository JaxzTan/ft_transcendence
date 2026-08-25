# Architecture

## Services

| Service | Role |
|---|---|
| `nginx` | TLS termination, single public entrypoint, reverse proxy |
| `frontend` (`frontend-dev` in dev) | React SPA, built and published into a shared static volume |
| `backend` | NestJS API — auth, users, friends, presence, notifications, achievements, leaderboard, player stats |
| `ludo-engine` | Standalone Node/Socket.IO service — runs the authoritative Ludo match state and game loop |
| `db` | PostgreSQL — durable data (users, friendships, match history, achievements) |
| `redis` | Live/ephemeral state — board, dice, turn pointer, matchmaking queue, presence — and the Socket.IO cross-instance adapter |
| `studio` | Prisma Studio, for local DB inspection only |

## Request flow

```
Browser
  │  HTTPS :443
  ▼
nginx
  ├─ /              → static SPA files (from the shared build volume)
  ├─ /api/*          → backend:3000   (NestJS — REST + auth)
  ├─ /api/health      → backend:3000/health
  └─ /socket.io/*    → ludo-engine:3001  (game state, moves, board updates)
```

nginx is the only service exposed to the outside. The SPA, the REST API, and the game socket
are all served from one origin — the frontend never needs to know the backend's or
ludo-engine's real hostname/port, in local, LAN, or ngrok-tunneled mode.

## Why two backend services

`backend` (NestJS) and `ludo-engine` are split deliberately:

- **`backend`** owns durable, relational data — accounts, friendships, match history,
  achievements — behind a conventional REST API backed by Postgres via Prisma.
- **`ludo-engine`** owns one thing: the server-authoritative game loop. Dice rolls, turn
  order, captures, and home entry are resolved here, over Socket.IO, against state held in
  Redis — not Postgres — because that state is high-frequency and worthless the instant a
  match ends. Only the final outcome (result, opponents, duration, rating delta) is handed
  back to `backend` to persist.

This keeps write-heavy transactional data (Postgres) separate from write-heavy ephemeral
data (Redis), and keeps the game loop from competing with the REST API for the same process.

## Data flow: a match

1. Client authenticates against `backend` (`/api/*`), gets a session.
2. Client connects to `ludo-engine` over `/socket.io/`, authenticated with that same session.
3. `ludo-engine` runs the match — every move is a request the server validates against its
   own board state in Redis; the client only renders.
4. Redis also backs the Socket.IO adapter, so broadcasts reach every connected client
   regardless of which `ludo-engine` instance holds the socket.
5. On match end, `ludo-engine` writes the durable result back through `backend`, which
   persists it to Postgres and updates leaderboard/stats/achievements.

## Local development

`frontend-dev` runs Vite's dev server with its own proxy (see `frontend/vite.config.ts`)
mirroring the same `/api/` and `/socket.io/` routing nginx does in built/deployed mode, so
the frontend code never branches on environment.

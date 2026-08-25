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
nginx (nginx/conf/app.inc)
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

## File structure

```
backend/
  src/
    main.ts                    # Nest bootstrap, mounts /health at root (not /api)
    app.module.ts               # wires every feature module + global ThrottlerGuard
    prisma.service.ts           # Prisma client wrapper (backend/generated/prisma)
    secrets.ts                  # reads <SECRETS_DIR>/<name>.txt, falls back to env
    auth/                       # local + OAuth (42, GitHub, Google, + ngrok variants), JWT, 2FA, mail
    user/                       # profile CRUD
    friends/                    # friend requests / accept / block
    presence/                   # online/offline status (SSE), backed by redis
    notification/               # in-app notifications (friend req, invites, achievements)
    match/                      # match lifecycle — see "Match module" below
    leaderboard/                 # rating leaderboard, snapshot persistence
    achievements/                # achievement rules + evaluation (see docs/achievement.md)
    player-stats/                 # per-user aggregate stats
    common/
      bot.ts                    # bot user-id convention (`bot-*`), isBotUserId()
      scoring.ts                 # ratingDeltaFor() — Elo-style rating math
  prisma/
    schema.prisma                # User, Achievement, Game, GameParticipant, Friendship, ...
    seed.ts                      # 28-player seed roster + Viper_X/bossku fixtures
  app/
    ludo-engine/                 # standalone Socket.IO game service (own package.json/Dockerfile)
      src/
        index.ts                 # entrypoint — starts SocketServer on $PORT (3001)
        engine.ts                 # LudoEngine — dice, moves, captures, turn order, win condition
        move-validator.ts          # legal-move computation
        clash.ts                   # clash-mode mini-game (capture contest) state machine
        board-mapper.ts             # board-position <-> path-index mapping
        bot.ts                     # PvE bot move selection
        lobby.ts                    # pre-game lobby (ready-up, color select)
        player-handler.ts            # per-connection player state
        redis.ts                    # RedisGameStore — match/board/dice state, matchmaking queue
        types.ts                    # shared engine types (PlayerColor, GameState, ...)
        socket/
          server.ts                 # Socket.IO server bootstrap, connection handling
          socket-handlers.ts          # event handlers (join_game, roll_dice, move_piece, ...)
          auth.ts                    # verifies the JWT minted by backend's MatchPlayerService
          event-publisher.ts          # emits ServerEvents to sockets in a game room
          redis-broadcaster.ts         # cross-instance broadcast via Redis pub/sub
          result-submitter.ts          # POSTs final result to backend on game end
    postgres_16_db/               # custom Postgres image + init script
    redis/                        # custom Redis image + init script

frontend/
  src/
    main.tsx / App.tsx / router.tsx  # app bootstrap + routes
    api.ts                       # REST client (fetch wrapper against /api/*)
    socket.ts                     # Socket.IO client — ServerEvents/ClientEvents contracts
    store.tsx                     # global app state (auth/session)
    pages/                        # one file per route (Home, Lobby, Game, Leaderboard, Profile, ...)
    components/                   # Board, Die, RulesModal, NotificationBell, ...
    game/
      reducer.ts                  # client-side game state reducer, driven by socket events
      types.ts                    # mirrors ludo-engine's GameState/MoveResult shapes
      ClashOverlay.tsx              # clash-mode UI
    hooks/useNotifications.ts      # SSE subscription to /api/notifications
    locales/                      # en / fr / ms i18n strings

nginx/
  conf/app.inc                    # the routing table in "Request flow" above
  conf/nginx.conf                 # TLS + server block
```

## Match module (backend/src/match/)

Split by responsibility rather than one god-service:

| File | Responsibility |
|---|---|
| `match.controller.ts` | REST surface — `POST /api/match/{pvp/invite,join/:code,pvp/random,pve,create,rematch/:gameId}`, `POST /api/game/:id/{ready,resign,exit,abort,started,invite,rejoin}`, `GET /api/games/{active,rooms,mine}`, `POST /api/game/end` |
| `match.creator.service.ts` | Creates a match room (PvP invite/random/PvE), reserves it in Redis |
| `match.player.service.ts` | Seats a player into a match, **mints the per-player JWT** (`gameId`, `playerId`, `role`, `color`, ...) that authenticates the browser's Socket.IO connection to `ludo-engine` |
| `match.query.service.ts` | Read-only lookups — active games, rooms, "my games" |
| `match.postgame.service.ts` | Receives `ludo-engine`'s result callback, writes `Game`/`GameParticipant` rows, computes rating deltas (`common/scoring.ts`), updates leaderboard + triggers achievement evaluation |
| `match.service.ts` | Thin facade the controller depends on, delegating to the services above |

## Data flow: a match

1. Client authenticates against `backend` (`/api/*`), gets a session (JWT cookie).
2. Client calls a `match.controller.ts` endpoint (e.g. `POST /api/match/pve`). `match.creator.service.ts` reserves the match in Redis; `match.player.service.ts` mints a short-lived JWT scoped to `{gameId, playerId, role, color}` and returns it with the game id.
3. Client connects to `ludo-engine` over `/socket.io/`, presenting that JWT. `ludo-engine/src/socket/auth.ts` verifies it (HMAC-SHA256, no external session lookup — the token is self-contained) and attaches `SocketData` to the connection.
4. `ludo-engine/src/socket/socket-handlers.ts` dispatches client events (`roll_dice`, `move_piece`, ...) into `engine.ts` / `move-validator.ts` / `clash.ts`, which validate against board state held in `redis.ts` (`RedisGameStore`) — the client only renders what `event-publisher.ts` broadcasts back.
5. `redis-broadcaster.ts` fans events out via Redis pub/sub, so broadcasts reach every connected client regardless of which `ludo-engine` instance holds the socket.
6. On match end, `result-submitter.ts` POSTs the final result to `backend`'s `POST /api/game/end`, authenticated with a static engine API key (`secrets/engine_api_key.txt`) rather than a player JWT.
   - **Exception:** HOTSEAT games are demo-and-forget — `result-submitter.ts` short-circuits and never calls the backend, so no `Game`/`GameParticipant` rows, lifetime counters, or leaderboard updates happen for hotseat play.
7. `match.postgame.service.ts` persists the result inside a Postgres transaction (idempotent on `gameId` — a retried callback is a no-op), applies `ratingDeltaFor()`, updates the leaderboard snapshot, and runs achievement evaluation (`achievements.service.ts` against `achievements.registry.ts`).

## Local development

`frontend-dev` runs Vite's dev server with its own proxy (see `frontend/vite.config.ts`)
mirroring the same `/api/` and `/socket.io/` routing nginx does in built/deployed mode, so
the frontend code never branches on environment.

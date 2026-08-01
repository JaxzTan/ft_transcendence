# ft_transcendence — Ludo Royale

A real-time multiplayer Ludo game built as a six-service Docker Compose stack.
The backend is a NestJS REST API, the game engine is a standalone Node.js
Socket.IO server with an inline heuristic bot AI, and the frontend is a React SPA
served over TLS by nginx.

> **Frontend status (as of 24 Jul 2026):** The SPA pages are visual stubs with
> local mock state. There is no Socket.IO client yet — real-time game connection
> is pending (see [roadmap.md](docs/roadmap.md) Phases 5 & 6).

---

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Browser │────▶│  nginx   │────▶│   backend    │
│  :8443   │     │  :443    │     │  NestJS :3000 │
└──────────┘     │ TLS+SPA  │     └──────┬───────┘
       │         └──────────┘            │
       │                                 ▼
       └──▶ /auth/* ──▶ backend:3000  ┌────────┐
          (bypasses nginx)            │  db    │
                                      │ :5432  │
              ┌──────────────┐        └────────┘
              │ ludo-engine  │────────▶┌────────┐
              │ Socket.IO    │        │ redis  │
              │ + inline bot │        │ :6379  │
              │ :3001        │        └────────┘
              └──────────────┘
```

> **Note:** The bot AI runs **inline** inside the ludo-engine process
> (`backend/app/ludo-engine/src/bot.ts`). There is no separate bot container.

For the full topology, deployment paths, and design decisions, see
[architecture.md](docs/architecture.md).

---

## Directory Layout

```
.
├── compose.yaml                  # Docker Compose — all 6 services
├── Makefile                      # Build / run / dev / clean targets
├── secrets/                      # File-based secrets (gitignored)
│
├── backend/                      # NestJS REST API (port 3000)
│   ├── Dockerfile
│   ├── docker-entrypoint.sh      # Prisma push + app start
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma.config.ts
│   │
│   ├── src/                      # NestJS feature modules
│   │   ├── app.module.ts         # Root module (7 feature modules)
│   │   ├── main.ts               # Bootstrap, cookie-parser, CORS, /health
│   │   ├── prisma.service.ts     # Prisma client singleton
│   │   ├── secrets.ts            # File-based secret resolution
│   │   │
│   │   ├── auth/                 # JWT + OAuth (Google, GitHub, 42)
│   │   │   ├── auth.controller.ts    # register, login, logout, me, OAuth
│   │   │   ├── auth.service.ts       # Token signing, password hashing
│   │   │   ├── auth.module.ts
│   │   │   ├── jwt.strategy.ts       # Reads token from httpOnly cookie
│   │   │   ├── jwt-auth.guard.ts     # Route guard
│   │   │   ├── jwt-payload.ts        # Type definitions
│   │   │   ├── google.strategy.ts    # Google OAuth
│   │   │   ├── github.strategy.ts    # GitHub OAuth
│   │   │   ├── fortytwo.strategy.ts  # 42 (intra) OAuth
│   │   │   ├── oauth.guards.ts       # OAuth route guards
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   │
│   │   ├── user/                 # User profiles & game history
│   │   │   ├── user.controller.ts    # profile, games, avatar CRUD
│   │   │   ├── user.service.ts
│   │   │   └── user.module.ts
│   │   │
│   │   ├── friends/              # Friend system
│   │   │   ├── friends.controller.ts # request, accept, decline, remove, list, block
│   │   │   ├── friends.service.ts
│   │   │   └── friends.module.ts
│   │   │
│   │   ├── match/                # Matchmaking & game lifecycle
│   │   │   ├── match.controller.ts   # PvP/PvE/hotseat, rematch, spectate, game end
│   │   │   ├── match.service.ts      # Redis matchmaking, rating updates
│   │   │   └── match.module.ts
│   │   │
│   │   ├── leaderboard/          # Rankings
│   │   │   ├── leaderboard.controller.ts  # GET /api/leaderboard
│   │   │   ├── leaderboard.service.ts     # Postgres fallback
│   │   │   ├── leaderboard-redis.service.ts  # Redis sorted sets
│   │   │   └── leaderboard.module.ts
│   │   │
│   │   ├── achievements/         # 15 Ludo achievements
│   │   │   ├── achievements.controller.ts  # GET, POST /check
│   │   │   ├── achievements.service.ts
│   │   │   └── achievements.module.ts
│   │   │
│   │   └── player-stats/         # Per-player aggregates
│   │       ├── stats.controller.ts
│   │       ├── stats.service.ts
│   │       └── stats.module.ts
│   │
│   ├── app/
│   │   └── ludo-engine/          # Standalone game engine (port 3001)
│   │       ├── Dockerfile
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── src/
│   │           ├── index.ts              # Entry point → SocketServer.start(3001)
│   │           ├── engine.ts             # Game state machine (roll, move, win)
│   │           ├── move-validator.ts     # Legal move computation
│   │           ├── board-mapper.ts       # Board geometry (safe zones, tracks)
│   │           ├── clash.ts              # Clash minigame (key-press race)
│   │           ├── bot.ts                # Heuristic bot AI
│   │           ├── player-handler.ts     # Disconnect/reconnect/exit/ready
│   │           ├── lobby.ts              # Lobby management (color selection)
│   │           ├── redis.ts              # RedisGameStore (persistence)
│   │           ├── types.ts              # GameState, PlayerColor, events
│   │           └── socket/
│   │               ├── server.ts             # SocketServer, event routing
│   │               ├── socket-handlers.ts    # join_game, roll_dice, move_piece, etc.
│   │               ├── auth.ts               # JWT middleware, GameSocket type
│   │               ├── event-publisher.ts    # Redis pub/sub → Socket.IO bridge
│   │               ├── redis-broadcaster.ts  # Room-based state broadcasts
│   │               └── result-submitter.ts   # POST /api/game/end to backend
│   │
│   ├── prisma/
│   │   ├── schema.prisma         # DB schema (single source of truth)
│   │   ├── seed.ts               # Development seed data
│   │   ├── drop-all.sql          # Cleanup script
│   │   └── migrations/
│   │       └── migration_lock.toml
│   │
│   ├── postgres_16_db/           # Custom PostgreSQL image
│   │   ├── Dockerfile
│   │   └── postgres_16_db-init.sh
│   │
│   └── redis/                    # Custom Redis image
│       ├── Dockerfile
│       └── redis-init.sh
│
├── frontend/                     # React SPA (build-only job)
│   ├── Dockerfile                # Production build
│   ├── Dockerfile.dev            # Vite HMR (dev profile)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── index.html
│   ├── .oxlintrc.json
│   │
│   ├── public/
│   │   ├── forty_two.png         # 42 OAuth button
│   │   ├── github.png            # GitHub OAuth button
│   │   └── google.png            # Google OAuth button
│   │
│   └── src/
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Root component
│       ├── index.css             # Global styles
│       ├── theme.ts              # Theme constants
│       ├── router.tsx            # Hand-rolled window.location router
│       ├── store.tsx             # React context + HTTP client (fetchApi)
│       ├── data.ts               # Mock game data
│       │
│       ├── pages/                # ⚠️ Visual stubs — no real-time connection
│       │   ├── Home.tsx          # Landing page
│       │   ├── Login.tsx         # Login form
│       │   ├── Signup.tsx        # Registration form
│       │   ├── Dashboard.tsx     # User dashboard (mock stats)
│       │   ├── Game.tsx          # Game board (local state, Math.random dice)
│       │   ├── Lobby.tsx         # Game lobby (seat selection, mock creation)
│       │   ├── Friends.tsx       # Friend list
│       │   ├── Leaderboard.tsx   # Rankings display
│       │   ├── Results.tsx       # Post-game results
│       │   └── Settings.tsx      # User settings
│       │
│       └── components/
│           ├── AuthLayout.tsx    # Auth page wrapper
│           ├── Board.tsx         # Ludo board SVG renderer
│           ├── Die.tsx           # Dice face SVG renderer
│           ├── OAuthButtons.tsx  # Google/GitHub/42 login buttons
│           └── Shell.tsx         # App shell with navigation
│
├── nginx/                        # TLS termination & reverse proxy
│   ├── Dockerfile
│   ├── nginx.sh
│   └── conf/
│       └── nginx.conf            # TLS, SPA serving, /api/* proxy
│
└── docs/                         # Documentation
    ├── architecture.md           # Full architecture reference
    ├── roadmap.md                # Migration roadmap (status)
    ├── roadmap2.md               # Refactoring roadmap (all completed)
    ├── LUDO_ENGINE.md            # Engine logic flow
    ├── BACKEND_LOGIC.md          # Match & game logic flow
    ├── Ludo_Rules.md             # Classic Ludo rules
    ├── TYPESCRIPT.md             # TypeScript patterns used
    └── API-list.md               # Complete HTTP + WebSocket API reference
```

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- `make`
- OAuth client IDs/secrets for Google, GitHub, and 42 (optional — local auth works without them)

### Commands

| Command | Effect |
|---|---|
| `make prepare-secrets` | Generate derivable secrets (never overwrites existing) |
| `make check-secrets` | Fail fast if any OAuth secret is missing |
| `make` or `make all` | `check-secrets` → `build` → `start` |
| `make start` | Build images + start default profile (production) |
| `make dev` | Start default + `dev` profile with Vite HMR on `:8080` |
| `make stop` | Stop all services (profile-aware) |
| `make down` | Stop + remove containers |
| `make logs` | Tail logs from all services |
| `make clean` | `down` + remove images |
| `make fclean` | `clean` + remove volumes |
| `make prune` | Full Docker system prune |
| `make re` | `stop` → `down` → `all` (full rebuild) |

### Access

| URL | Service | Profile |
|---|---|---|
| `https://localhost:8443` | nginx (production SPA + API) | default |
| `http://localhost:8080` | Vite HMR dev server | dev |
| `http://localhost:3000` | Backend API (direct) | default |
| `ws://localhost:3001` | Ludo engine (Socket.IO) | default |

---

## Status

| Component | Status | Notes |
|---|---|---|
| Backend API (NestJS) | ✅ Complete | 7 modules, all endpoints implemented |
| Game Engine (Socket.IO) | ✅ Complete | State machine, clash, Redis persistence |
| Bot AI | ✅ Complete | Heuristic (capture priority, safe zone bonus, threat avoidance) |
| Docker Infrastructure | ✅ Complete | 6 services, TLS, secrets, health checks |
| Frontend SPA | ⏳ Partial | Pages exist as visual stubs with local mock state. No Socket.IO client yet. |
| Real-time Integration | ⏳ Pending | Frontend needs to connect to engine via Socket.IO (Phases 5 & 6) |

---

## Documentation

| Document | Description |
|---|---|
| [architecture.md](docs/architecture.md) | Full system topology, services, request paths, data layer |
| [roadmap.md](docs/roadmap.md) | Migration roadmap with phase-by-phase status |
| [API-list.md](docs/API-list.md) | Complete HTTP + WebSocket API reference |
| [LUDO_ENGINE.md](docs/LUDO_ENGINE.md) | Engine logic flow, game lifecycle, event protocol |
| [BACKEND_LOGIC.md](docs/BACKEND_LOGIC.md) | Matchmaking flow, Redis keys, Postgres schema |
| [Ludo_Rules.md](docs/Ludo_Rules.md) | Classic Ludo rules reference |
| [TYPESCRIPT.md](docs/TYPESCRIPT.md) | TypeScript patterns used in the project |
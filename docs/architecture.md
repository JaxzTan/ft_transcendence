# Architecture

**Project:** ft_transcendence — Ludo Royale
**Updated:** 2026-07-25

A six-service Docker Compose stack: a React SPA built by a one-shot job and served
over TLS by nginx, a NestJS API, a standalone real-time game engine (with an
inline bot AI), PostgreSQL, and Redis.

---

## Topology

```mermaid
graph TB
    Browser["Browser"]

    subgraph net["transcendence_network"]
        nginx["nginx :443<br/>TLS · serves SPA"]
        backend["backend :3000<br/>NestJS API"]
        engine["ludo-engine :3001<br/>socket.io + inline bot AI"]
        db[("db :5432<br/>PostgreSQL 16")]
        redis[("redis :6379<br/>internal only")]
        fe["frontend<br/>build job · exits 0"]
    end

    Browser -->|"https :8443"| nginx
    nginx -->|"/api/*"| backend
    fe -->|"publishes dist/"| spa[("spa_dist volume")]
    spa -->|"read-only"| nginx
    backend --> db
    backend --> redis
    engine --> redis
    engine -.->|"BACKEND_URL"| backend
```

> **Note:** Auth endpoints use `@Controller('api/auth')`, so they are proxied
> through nginx like all other API routes. There is no direct browser→backend
> path for auth.

---

## Services

| Service | Host port | Container | Profile | Role |
|---|---|---|---|---|
| `nginx` | 8443 | 443 | default | TLS termination, serves built SPA, proxies `/api/*` |
| `backend` | 3000 | 3000 | default | NestJS REST API, auth, persistence |
| `ludo-engine` | 3001 | 3001 | default | Authoritative game state + inline bot AI via socket.io |
| `db` | 5432 | 5432 | default | PostgreSQL 16, Prisma-managed |
| `redis` | — | 6379 | default | Game state + leaderboard cache; **not published** |
| `frontend` | — | — | default | Build-only job; compiles SPA, exits 0 |
| `frontend-dev` | 8080 | 8080 | **dev** | Vite HMR server — only started by `make dev` |

Images are built from `Dockerfile`s in each service directory. `db` and `redis` wrap
their official images with an init script that reads secrets before `exec`ing the
real process (`backend/app/postgres_16_db/`, `backend/app/redis/`).

> **Note:** There is no separate `ludo-bot` container. The bot AI lives inside the
> `ludo-engine` process (`backend/app/ludo-engine/src/bot.ts`). The engine accepts
> a `bot` role in the JWT and can auto-fill slots with bot players.

---

## The SPA build handoff

The frontend is **not** a server. It is a one-shot job:

1. `frontend` builds the SPA (`tsc -b && vite build`) into `/app/dist`.
2. Its `CMD` copies that into `/export`, which is the `spa_dist` named volume, then exits 0.
3. `nginx` mounts `spa_dist` read-only at `/usr/share/nginx/html`.

`nginx` gates on `depends_on: frontend: condition: service_completed_successfully`,
so it cannot start against an empty document root on first boot.

> A single `📦 SPA published to spa_dist` log line followed by `exited (0)` is the
> success case for the `frontend` container, not a crash.

The nginx config is **bind-mounted** from `nginx/conf/nginx.conf`, so config edits
need only a container restart, not an image rebuild. The `Dockerfile` also `COPY`s it
as a fallback so the image stays runnable standalone.

---

## Request paths

**Static / SPA** — `https://localhost:8443/*` → nginx → `try_files $uri $uri/ /index.html`,
so client-side routing works on deep links. `frontend/src/router.tsx` is a hand-rolled
`window.location` router, not React Router.

**API** — `https://localhost:8443/api/*` → `proxy_pass http://backend:3000`. The `/api`
prefix is *preserved*, so controllers must include it themselves. There is no global
prefix in `backend/src/main.ts`; each controller carries `api/` in its own decorator.

**Auth** — `@Controller('api/auth')` includes the `api/` prefix, so `/api/auth/*`
is proxied through nginx to backend:3000. OAuth callback secrets point at
`http://localhost:3000` because the OAuth providers redirect back server-side.

**Game realtime** — socket.io to `ludo-engine:3001`. The SPA currently has **no
socket client** — real-time game play is not yet wired up from the browser. The
inline bot AI connects internally; the engine is ready to accept client connections.

---

## Data layer

### PostgreSQL

Prisma-managed, schema at `backend/prisma/schema.prisma`.

**Models:** `User`, `Account` (OAuth provider links), `Game`, `GameParticipant`, `Friendship`
**Enums:** `FriendshipStatus`, `UserStatus`, `PlayerColor`, `GameStatus`, `GameType`

Schema is applied with `npx prisma db push --accept-data-loss` from
`backend/docker-entrypoint.sh` on every boot. **There is no migration history** — this
is a deliberate project choice, so treat the schema file as the single source of truth
and never hand-edit the database.

`DATABASE_URL` is assembled at container start from `db_credentials.txt` +
`db_password.txt`, producing `@db:5432`. It is *not* read from `database_url.txt`,
which holds the host-side URL (`@localhost:5432`) for running the app outside Docker.
The two are not interchangeable.

### Redis

Two distinct uses:

- **Leaderboard cache** — `LeaderboardRedisService`, sorted sets keyed `leaderboard:{mode}`, with a PostgreSQL fallback on read failure.
- **Live game state** — `MatchService` (matchmaking, rematch, active games) and the engine's `RedisGameStore`.

Redis runs with `requirepass` sourced from `redis_password.txt`. Only the leaderboard
service currently authenticates — other services (matchmaking, engine) do not yet
authenticate their Redis connections.

---

## Backend modules

`backend/src/app.module.ts` composes seven feature modules (CronModule was removed —
Redis TTL handles cleanup):

| Module | Route prefix | Responsibility |
|---|---|---|
| `AuthModule` | `/api/auth` | Local + Google/GitHub/42 OAuth, JWT cookie issuance |
| `UserModule` | `/api/user` | Profile, avatar, game history |
| `FriendsModule` | `/api/friends` | Requests, accept/decline, block |
| `LeaderboardModule` | `/api/leaderboard` | Rankings, Redis-backed with Postgres fallback |
| `AchievementsModule` | `/api/achievements` | 15 Ludo achievements |
| `StatsModule` | `/api/stats` | Per-player aggregates |
| `MatchModule` | `/api/match`, `/api/game` | Matchmaking (PvP/PvE/hotseat), game lifecycle |

### Auth flow

1. `GET /api/auth/{google,github,42}` → passport guard redirects to the provider.
2. Provider redirects to the callback URL from `secrets/{provider}_callback_url.txt`.
3. Strategy upserts `User` + `Account`, `AuthService` signs a JWT.
4. Token is set as an `httpOnly`, `sameSite: lax` cookie named `token`, `secure` when `NODE_ENV=production`.
5. Browser is redirected to `FRONTEND_URL` (`https://localhost:8443`).
6. `JwtStrategy` reads the token from `req.cookies` — `cookieParser()` in `main.ts` is required for this.

---

## Secrets

One value per file under `secrets/`, named after the variable it holds, lowercased —
`JWT_SECRET` → `secrets/jwt_secret.txt`. The directory is bind-mounted read-only at
`/secrets` in every service that needs it.

**Nothing sensitive passes through `.env` or the compose environment.** No
`--env-file` is used anywhere. The remaining `${...}` in `compose.yaml` are non-secret
topology values and all carry defaults, so the stack runs with no `.env` present.

Resolution order in `backend/src/secrets.ts`: `SECRETS_DIR` → `/secrets` →
`../secrets` → `./secrets`, so host-run `npm run start:dev` sees the same files as
containers. `requireSecret()` throws at boot on a missing value; `secret()` returns
`undefined` and falls back to `process.env`.

`make prepare-secrets` generates or seeds everything derivable. `make check-secrets`
hard-fails on the nine OAuth values, which must come from the provider consoles.

---

## Dev vs. production paths

Both run simultaneously and independently:

| | `make start` | `make dev` |
|---|---|---|
| Compose profile | default | default + **dev** |
| SPA source | built, in `spa_dist` | live from bind mount |
| Served by | nginx, `https://localhost:8443` | Vite, `http://localhost:8080` |
| Reload | rebuild + restart | HMR |
| API access | nginx `/api` proxy | Vite `/api` proxy |

`frontend-dev` bind-mounts `./frontend:/app` with an anonymous volume over
`/app/node_modules` so the image's dependencies aren't shadowed by the host. Vite uses
`usePolling` when containerised — Docker Desktop on macOS does not deliver inotify
events through bind mounts, and HMR silently never fires without it.

`make dev` still brings up nginx, so the production path stays verifiable while you
iterate against HMR.

---

## Make targets

| Target | Effect |
|---|---|
| `all` | `check-secrets` → `build` → `start` |
| `prepare-secrets` | Generate/seed derivable secrets; never overwrites |
| `check-secrets` | Fail fast if an OAuth secret is missing |
| `build` / `start` | Build images / bring up the default profile detached |
| `dev` | Bring up default + `dev` profile with HMR |
| `stop` / `down` / `logs` | Profile-aware, so `frontend-dev` isn't orphaned |
| `clean` / `fclean` / `prune` | Docker teardown, increasing severity |
| `tunnel` / `dev-tunnel` / `stop-tunnel` | ngrok against 8443 |
| `re` | `stop` → `down` → `all` |
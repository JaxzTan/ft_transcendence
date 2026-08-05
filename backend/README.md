# Backend — NestJS API

The backend is a [NestJS](https://nestjs.com) application that handles HTTP matchmaking, user management, and persistent storage for the Ludo Royale game. It runs on port 3000.

It does **not** run game logic — that lives in `ludo-engine` (port 3001).

---

## Running

```bash
npm run start          # production
npm run start:dev      # watch mode
```

The backend expects a running PostgreSQL and Redis instance, with secrets available under `secrets/` or `../../secrets/`.

---

## Project Structure

```
src/
├── app.module.ts        ← Root module (composition root)
├── main.ts              ← Bootstrap, cookie-parser, CORS, /health endpoint
├── prisma.service.ts    ← Prisma client singleton
├── secrets.ts           ← File-based secret loading
├── auth/                ← JWT + OAuth (Google, GitHub, 42)
├── user/                ← Profiles, avatar, game history
├── friends/             ← Friend requests, block list
├── match/               ← Matchmaking (PvP/PvE/hotseat), game lifecycle
├── leaderboard/         ← Redis-backed leaderboard with Postgres fallback
├── achievements/        ← 15 Ludo-specific achievements
└── player-stats/        ← Per-player aggregate statistics
```

---

## Key Architecture

- **Auth:** JWT tokens in httpOnly cookies (`token`). Local register/login plus OAuth (Google, GitHub, 42).
- **Matchmaking:** Lives entirely in Redis (`match:{gameId}` hashes with 24h TTL). Supports PvP (random + invite), PvE (vs bots), and hotseat modes.
- **Persistence:** PostgreSQL via Prisma — only stores final game results (`Game` + `GameParticipant`), user profiles, friendships, and achievements.
- **Secrets:** File-based under `secrets/`. No `.env` files used. `requireSecret()` throws at boot on missing values.

---

## Endpoints

See [API-list.md](../docs/API-list.md) for the full reference.

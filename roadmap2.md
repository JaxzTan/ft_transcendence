# Backend Dead Code & Refactoring Roadmap

Findings from a full scan of `backend/src/` and `backend/app/ludo-engine/src/`.

---

## 🔴 CRITICAL — Will Cause Build Failures

### 1. Cron module — Entirely dead code

| File | Lines | Why it's dead |
|---|---|---|
| `backend/src/cron/cron.controller.ts` | 14 | Exposes `POST /api/cron/cleanup` — duplicate of `POST /api/match/cleanup` |
| `backend/src/cron/cron.service.ts` | 29 | `@Cron` decorator runs daily at 1AM but does nothing — just logs "Redis TTL handles it" |
| `backend/src/cron/cron.module.ts` | 12 | Wires the above together, imports `MatchModule` (unused) |
| `backend/src/app.module.ts` (line 9) | — | Imports `CronModule` — will error if cron files are deleted |

**Action:** Delete all 3 cron files, remove `CronModule` from `app.module.ts`.

---

## 🟡 HIGH — Duplicate or Redundant

### 2. `backend/src/user/reconnect.service.ts` — Duplicate of engine's disconnect logic

This service manages a 45-second reconnect window in the backend. But the **ludo-engine already has its own 30-second disconnect grace period** in `player-handler.ts`. Both run independently:

- **Backend:** `POST /api/user/disconnect` → starts 45s timer → marks user offline
- **Engine:** Socket disconnect → 30s grace → forfeit if no reconnect

These are **two separate reconnect systems** that don't talk to each other. The backend one has a `TODO` comment: "Notify ludo-engine to handle game timeout" — it was never wired up.

**Endpoints affected:**
- `POST /api/user/disconnect` — calls `reconnectService.startReconnectWindow()`
- `POST /api/user/reconnect` — calls `reconnectService.hasPendingReconnect()`

**Files:**
- `backend/src/user/reconnect.service.ts` (103 lines)
- `backend/src/user/user.controller.ts` (lines 29-86 — disconnect/reconnect endpoints)
- `backend/src/user/user.module.ts` (imports ReconnectService)

**Action:** Either remove the backend reconnect service entirely (engine handles it), or wire it up to actually communicate with the engine.

### 3. `backend/src/player-stats/` — Thin wrapper, could be merged

| File | Endpoint | What it does |
|---|---|---|
| `stats.controller.ts` | `GET /api/stats` | Returns user stats from Postgres |
| `stats.service.ts` | — | Queries `gameParticipant` table |
| `stats.module.ts` | — | Wires controller + service |

The same stats are already computed and returned by `POST /api/game/end` and `GET /api/user/:username/games`. This module is a thin wrapper that could be merged into the user module.

**Action:** Merge into `UserService` or keep as-is (it's small — 3 files, ~40 lines total).

---

## 🟠 MEDIUM — Unused Code in ludo-engine

### 4. `board-mapper.ts` — 6 of 9 methods are never called

| Method | Called by |
|---|---|
| `isSafeZoneStep()` | ✅ `bot.ts`, `move-validator.ts` |
| `toTrackPosition()` | ✅ `move-validator.ts` |
| `parsePieceId()` | ✅ Internal use only |
| `getAllPieceIds()` | ❌ **Never called anywhere** |
| `isHomeStretch()` | ❌ **Never called** |
| `isFinished()` | ❌ **Never called** |
| `isPrison()` | ❌ **Never called** |
| `isExited()` | ❌ **Never called** |
| `getPieceColor()` | ❌ **Never called** |

**Action:** Remove the 6 unused methods (or keep them as utility — they're small and document the step system).

### 5. `redis.ts` — `addPlayer()` method is dead

`RedisGameStore.addPlayer()` is defined but **never called**. The engine's `addPlayer()` in `engine.ts` directly calls `loadGameState` + `saveGameState` instead of using this wrapper.

**Action:** Remove the method.

### 6. `types.ts` — `ClientToServerEvents` and `ServerToClientEvents` interfaces are unused

These Socket.IO typed event interfaces are defined but **never imported anywhere**. The engine uses raw `socket.on('event')` and `socket.emit('event')` without type checking.

**Action:** Remove or start using them for type safety.

---

## 🟢 LOW — Minor Issues

### 7. `auth/auth.module.ts` — `import * as fs from 'fs'` is unused
Line 9 imports `fs` but it's never used anywhere in the module.

### 8. `auth/jwt.strategy.ts` — `import * as fs from 'fs'` is unused
Line 4 imports `fs` but it's never used.

### 9. `leaderboard/leaderboard.controller.ts` — `Optional` import is unused
Line 1 imports `Optional` from `@nestjs/common` but it's never used.

### 10. `match/match.module.ts` — `AchievementsModule` and `LeaderboardModule` imports
These are imported but `MatchService` doesn't inject `AchievementsService` or `LeaderboardService` directly — it only uses `PrismaService` and `JwtService`. The imports may be needed for module resolution, but worth verifying.

---

## 🏗️ ARCHITECTURE UPGRADE — Unified Game Modes

### Goal

Make the architecture flexible so any seat can be a human or a bot. The engine is already agnostic — it just processes `roll_dice` and `move_piece`. The only differences are:
1. How seats get filled (human socket vs bot scheduler)
2. How the game starts (ready check vs immediate)
3. How many sockets (one per player vs one for all in hot seat)

### Three Game Modes

| Mode | Seats | Bots | Start Condition | Sockets |
|---|---|---|---|---|
| **Hot seat** | 2-4 humans | 0 | Immediate (no ready check) | 1 socket controls all colors |
| **vs Bot** | 1 human + 1-3 bots | 1-3 | Immediate | 1 socket for human |
| **vs Multiplayer** | 2-4 humans | 0 | All players click "ready" | 1 socket per player |

### Unified Match Creation Endpoint

Replace the current 3 separate endpoints with one flexible endpoint:

```
POST /api/match/create
{
  "mode": "hotseat" | "pvp" | "pve",
  "playerCount": 2 | 3 | 4,
  "botCount": 0 | 1 | 2 | 3,
  "clashEnabled": true,
  "color": "red"  // creator's preferred color
}
```

**Rules:**
- `playerCount` = total seats (2-4)
- `botCount` = how many of those seats are bots
- `humanCount = playerCount - botCount`
- If `mode === 'pve'`: `botCount >= 1`, game starts immediately
- If `mode === 'hotseat'`: `botCount = 0`, game starts immediately
- If `mode === 'pvp'`: `botCount = 0`, status = WAITING, needs other players + ready check

### Engine Changes

| Change | Where | Complexity |
|---|---|---|
| `hotSeat` flag in JWT | `match.service.ts` + `socket/auth.ts` | Small |
| Skip `playerColor` check for hot seat | `socket/server.ts` event handlers | Tiny (~5 lines) |
| Allow one socket to join multiple colors | `socket/server.ts` `join_game` | Small |
| Remove separate PvE/PvP endpoints | `match.controller.ts` | Medium (API surface change) |

### What does NOT change

The board logic (`engine.ts`, `move-validator.ts`, `win-rules.ts`, `clash.ts`) is **completely untouched**. It's already agnostic to human vs bot.

---

---

## ✅ Completed

| Phase | Item |
|---|---|
| 1 | 🔴 Delete cron module |
| 2 | 🟢 Remove unused imports |
| 3 | 🟠 Clean up engine dead code |
| 4 | 🏗️ Unified match creation endpoint |
| 5 | 🏗️ Hot seat support |
| 6 | 🟡 Remove reconnect service |
| 7 | 🟡 Keep player-stats module as-is |

Also completed: broadcast clash to room, silent fail on invalid moves, ping interval tuning, inline EventPublisher, inline httpServer, reuse Redis subscriber.

---

## 🚧 Pending

### Phase 8: Simplify bot scheduling (event-driven)

**Current:** `BotScheduler` runs its own recursive `setTimeout(..., 500)` and uses a `botBusy` flag.
**Target:** Trigger bot turn from `handleEngineEvent` when `currentTurn` becomes a bot color. Remove `setTimeout` recursion and `botBusy`.

| What changes | Where |
|---|---|
| `BotScheduler.takeTurn()` — drop `setTimeout`, drop `botBusy` | `bot-scheduler.ts` |
| `handleEngineEvent` — after any event, check if `currentTurn` is bot and call `takeTurn()` | `server.ts` |
| No more self-scheduling bot loops | — |

**Benefit:** Bot turns execute inside the existing `enqueue()` cycle, so they're automatically serialized with human moves and disconnect handlers.

### Phase 9: Early turn validation in socket handlers

**Current:** `roll_dice` and `move_piece` rely on engine validation only. Out-of-turn moves are silently caught.
**Target:** Add explicit early-return guard before calling engine methods, so invalid input is rejected before it enters the queue.

```typescript
// roll_dice
if (socket.data.mode !== 'hotseat') {
  const state = await this.store.loadGameState(gameId);
  if (state && socket.data.playerColor !== state.currentTurn) return;
}

// move_piece
if (socket.data.mode !== 'hotseat') {
  const state = await this.store.loadGameState(gameId);
  const piece = state?.pieces.find(p => p.id === pieceId);
  if (!piece || piece.color !== state?.currentTurn) return;
}
```

**Benefit:** Fails fast, no unnecessary enqueue, clearer intent in code.

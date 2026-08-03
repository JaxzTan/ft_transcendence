# Backend Dead Code & Refactoring Roadmap

All items in this roadmap have been completed. This document is kept for historical reference.

---

## ✅ Completed Items

### 1. 🔴 Delete cron module — DONE
- `backend/src/cron/` directory removed entirely (all 3 files: controller, service, module)
- `CronModule` import removed from `app.module.ts`
- No more duplicate cleanup endpoints.

### 2. 🟡 Remove reconnect service — DONE
- `backend/src/user/reconnect.service.ts` removed
- Disconnect/reconnect endpoints removed from `user.controller.ts`
- ReconnectService import removed from `user.module.ts`
- The engine's built-in 30-second disconnect grace period handles reconnection.

### 3. 🟡 Keep player-stats module as-is — DONE
- `backend/src/player-stats/` retained with all 3 files.

### 4. 🟠 Clean up engine dead code — DONE
- `board-mapper.ts`: Removed 6 unused methods (`getAllPieceIds`, `isHomeStretch`, `isFinished`, `isPrison`, `isExited`, `getPieceColor`). Only 3 methods remain: `parsePieceId`, `isSafeZoneStep`, `toTrackPosition`.
- `redis.ts`: Removed `addPlayer()` method.
- `types.ts`: Removed unused `ClientToServerEvents` and `ServerToClientEvents` interfaces.

### 5. 🟢 Remove unused imports — DONE
- `auth/auth.module.ts`: Removed unused `import * as fs from 'fs'`
- `auth/jwt.strategy.ts`: Removed unused `import * as fs from 'fs'`
- `leaderboard/leaderboard.controller.ts`: Removed unused `Optional` import

### 6. 🏗️ Unified match creation endpoint — DONE
- `POST /api/match/create` exists with `mode` (pvp/pve/hotseat), `playerCount`, `botCount`, `clashEnabled`, `color` parameters.
- Separate legacy endpoints (`/pvp/random`, `/pvp/invite`, `/pve`) also remain.

### 7. 🏗️ Hot seat support — DONE
- `hotSeat`/`mode` flag in JWT (`socket/auth.ts`)
- Skip `playerColor` check for hot seat in `socket/server.ts`
- One socket can control multiple colors in hot seat mode.

### 8. ♻️ Bot scheduling (was Phase 8) — DONE (better than planned)
- **No `BotScheduler` class was ever created** — bot scheduling is event-driven from the start.
- Bot turns triggered from `handleEngineEvent` via `triggerBotTurn()` in `server.ts`
- No `setTimeout` recursion for bot turns — they execute synchronously inside the event queue
- The only `setTimeout` in the engine is for disconnect/reconnect timeouts and post-game lobby expiry
- `botBusy` field still exists in `types.ts` as a vestigial safety flag (not actively used for scheduling)

### 9. 🛡️ Early turn validation in socket handlers — DONE
- Already implemented in `socket-handlers.ts`:
  - `handleRollDice` (line 77-79): loads game state and returns early if `currentTurn !== playerColor`
  - `handleMovePiece` (line 100-102): loads game state and returns early if `currentTurn !== color` or piece doesn't belong to current player
- Guards are skipped for hot seat mode (socket may have no `playerColor`)
- Out-of-turn actions are silently ignored (defense in depth)

### Additional items completed:
- Broadcast clash to room
- Silent fail on invalid moves
- Ping interval tuning
- Inline EventPublisher (removed separate class)
- Inline httpServer (created inside server.ts)
- Reuse Redis subscriber

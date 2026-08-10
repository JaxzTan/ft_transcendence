# Fix: Dice Roll / Turn Skipping Bug — Minimal Patch for `fixbugs-trams-7thAug`

## Symptom

When a human player clicks "Roll Dice", the game immediately advances to the next player (bot) without:
- Showing the dice roll result
- Highlighting legal moves
- Waiting for the human to click a piece

## Root Cause

**File:** `backend/app/ludo-engine/src/socket/redis-broadcaster.ts` (line 44)

```ts
io.to(gameId).emit('state_update', data);
```

The `RedisBroadcaster` **always** emits the Socket.IO event name `state_update`, regardless of the actual event type. The engine publishes events with their own type (`dice_rolled`, `piece_moved`, `game_started`, `game_ended`, `clash_start`, `clash_result`, `player_exited`, `lobby_update`) via the `EventPublisher`, but the broadcaster re-labels every one of them as `state_update`.

So the payload arriving at the frontend is, e.g., `{ type: 'dice_rolled', value, legalMoves, bonusRoll, currentTurn }` — but it is delivered under the Socket.IO event name `state_update`, and a dedicated `socket.on('dice_rolled')` handler would **never fire**.

---

## Current State of `fixbugs-trams-7thAug` (verified)

| File | Line(s) | State |
|------|---------|-------|
| `backend/app/ludo-engine/src/engine.ts` | 87, 110, 121 | ✅ `dice_rolled` emits already include `currentTurn: state.currentTurn` |
| `backend/app/ludo-engine/src/types.ts` | 106 | ✅ `GameEvent` `dice_rolled` already has `currentTurn: PlayerColor` |
| `frontend/src/game/reducer.ts` | 80-89 | ✅ `dice_rolled` case already updates `currentTurn` from the event |
| `backend/app/ludo-engine/src/socket/redis-broadcaster.ts` | 44 | ❌ Still hardcodes `emit('state_update', data)` |
| `backend/app/ludo-engine/src/socket/event-publisher.ts` | 20-27 | ❌ `dice_rolled` publish serialization **drops `currentTurn`** |
| `frontend/src/socket.ts` | 6 | ❌ `dice_rolled` ServerEvents type lacks `currentTurn` |
| `frontend/src/pages/Game.tsx` | 90-138 | ⚠️ Workaround: single `state_update` handler that re-keys via spread `{ type: 'state_update', ...state }` |

The 7th Aug repo already made the engine/reducer/type prep changes. **The only remaining root-cause gap is the broadcaster + the publisher dropping `currentTurn` + the frontend's Socket.IO typing.**

---

## Proposed Minimal Fix (4 small changes)

### Change 1 — `redis-broadcaster.ts` (line 44): emit the real event type

**File:** `backend/app/ludo-engine/src/socket/redis-broadcaster.ts`

```ts
// BEFORE
io.to(gameId).emit('state_update', data);

// AFTER
io.to(gameId).emit(data.type, data);
```

This is THE root-cause fix. Now `dice_rolled`, `piece_moved`, `game_started`, `game_ended`, `player_exited`, `clash_start`, `clash_result`, `clash_frozen`, and `lobby_update` are delivered under their real Socket.IO event names. (`game_joined`, `clash_press_registered`, `game_timeout`, `game_expired`, `game_created` are emitted directly via `socket.emit`/`io.emit` and are unaffected.)

### Change 2 — `event-publisher.ts` (lines 20-27): forward `currentTurn`

**File:** `backend/app/ludo-engine/src/socket/event-publisher.ts`

The publisher currently serializes `dice_rolled` WITHOUT `currentTurn`, even though the engine already emits it and `types.ts` declares it. Without this, the frontend can't show the correct player after an auto-advance.

```ts
case 'dice_rolled':
  this.store.publish(gameId, JSON.stringify({
    type: 'dice_rolled',
    value: event.value,
    legalMoves: event.legalMoves,
    bonusRoll: event.bonusRoll,
    currentTurn: event.currentTurn,   // ← ADD THIS
  }));
  break;
```

### Change 3 — `frontend/src/socket.ts` (line 6): add `currentTurn` to the type

```ts
dice_rolled: (e: { value: number; legalMoves: LegalMove[]; bonusRoll: boolean; currentTurn: PlayerColor }) => void
```

### Change 4 — `frontend/src/pages/Game.tsx` (lines 90-138): handle typed events

After Change 1, engine events no longer arrive as `state_update` — they arrive under their own names. The existing 7th Aug handler body already correctly re-keys by `state.type`, so we simply **extract it into a function and register it on all the engine event names**. No logic is rewritten — this is purely re-wiring.

**Recommended (clear, ~12 lines):**

```ts
const handleEngineEvent = (state: unknown) => {
  const type = (state as { type?: string }).type
  dispatch({ type: 'state_update', ...(state as object) })

  if (type === 'dice_rolled') {
    setIsRolling(false)
    const e = state as unknown as { value: number; bonusRoll: boolean }
    setMoveLogs((prev) => [
      { ck: viewRef.current.currentTurn, text: `Rolled a ${e.value}${e.bonusRoll ? ' (bonus)' : ''}` },
      ...prev.slice(0, 7),
    ])
  } else if (type === 'piece_moved') {
    const e = state as unknown as { color: PlayerColor; captured: boolean; to: number }
    setMoveLogs((prev) => [
      { ck: e.color, text: e.captured ? `Captured a piece! → step ${e.to}` : `Moved to box ${e.to}` },
      ...prev.slice(0, 7),
    ])
  } else if (type === 'lobby_update') {
    // ... existing lobby_update / my_color_changed logic ...
  } else if (type === 'game_ended') {
    // ... existing game_ended logic ...
  }
}

socket.on('state_update', handleEngineEvent)
socket.on('dice_rolled', handleEngineEvent)
socket.on('piece_moved', handleEngineEvent)
socket.on('game_started', handleEngineEvent)
socket.on('game_ended', handleEngineEvent)
socket.on('player_exited', handleEngineEvent)
socket.on('clash_start', handleEngineEvent)
socket.on('clash_result', handleEngineEvent)
socket.on('clash_frozen', handleEngineEvent)
socket.on('lobby_update', handleEngineEvent)
```

**Compact alternative (`socket.onAny`, ~2-line change):**

```ts
const ENGINE_EVENTS = ['state_update','dice_rolled','piece_moved','game_started','game_ended','player_exited','clash_start','clash_result','clash_frozen','lobby_update']
socket.onAny((eventName, state) => {
  if (!ENGINE_EVENTS.includes(eventName)) return
  // ... same handler body as above ...
})
```

The dispatched action still spreads `...state` AFTER the literal `'state_update'`, so `state.type` (e.g. `'dice_rolled'`) wins and the reducer resolves the correct case. All reducer cases (`dice_rolled`, `piece_moved`, `game_started`, `game_ended`, `clash_start`, `clash_result`, `player_exited`, `lobby_update`) already exist.

---

## Why this is minimal

- **Change 1:** 1 line — the actual bug fix.
- **Change 2:** 1 line — makes the already-declared `currentTurn` actually reach the client.
- **Change 3:** 1 line — keeps TypeScript in sync.
- **Change 4:** re-wiring only — reuses the existing handler body verbatim; no game-logic changes.

The engine (`engine.ts`), types (`types.ts`), and reducer prep work are **already done** in the 7th Aug repo, so no changes are needed there.

---

## What NOT to change

- Do **not** revert `Game.tsx` to the old separate `socket.on('dice_rolled')` / `socket.on('piece_moved')` per-event wiring from `fixbugs-trans-6thAug` — the 7th Aug handler body already handles all event types in one place; we're just re-registering it.
- Do **not** touch `engine.ts`, `types.ts`, or `reducer.ts` — they already have the `currentTurn` support.

---

## Files to Modify

| File | Change | Size |
|------|--------|------|
| `backend/app/ludo-engine/src/socket/redis-broadcaster.ts` | Line 44: `emit(data.type, data)` | 1 line |
| `backend/app/ludo-engine/src/socket/event-publisher.ts` | `dice_rolled` publish: add `currentTurn` | 1 line |
| `frontend/src/socket.ts` | `dice_rolled` ServerEvents type: add `currentTurn` | 1 line |
| `frontend/src/pages/Game.tsx` | Register existing handler on typed event names | ~12 lines re-wiring |

## Verification

After the patch, trace a human turn:
1. Frontend emits `roll_dice` → `socket-handlers.ts` `handleRollDice` → `engine.rollDice`
2. Engine emits `dice_rolled` (with `currentTurn`) → `EventPublisher` publishes (now with `currentTurn`) → Redis → `RedisBroadcaster` emits **`dice_rolled`** (real name)
3. Frontend `handleEngineEvent` → dispatch `{ type: 'state_update', ...payload }` → reducer resolves `dice_rolled` → sets `diceValue`, `legalMoves`, `turnPhase: 'WAITING_FOR_MOVE'`, `currentTurn` → highlights legal pieces
4. Human clicks a highlighted piece → `move_piece` → `engine.movePiece` → `piece_moved` → frontend updates board and advances/keeps turn correctly
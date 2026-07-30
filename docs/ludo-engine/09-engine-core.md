# Ludo Engine — Core

## Table of Contents

- [Overview](#overview) — Core game logic, types, and validation
- [Files](#files) — Every source file in the module and its role
- [Key Types / Interfaces](#key-types--interfaces) — Game state, pieces, moves, and events
- [Core Logic / Flow](#core-logic--flow) — Mermaid sequence diagrams for dice roll, piece movement, and game lifecycle
- [Logic Paths Summary](#logic-paths-summary) — Decision trees for each operation
- [Dependencies](#dependencies) — Internal and external dependencies

---

## Overview

The Ludo Engine Core is the heart of the game logic. It provides:

1. **Game state management** — tracks board positions, player turns, and game phase.
2. **Dice rolling** — random 1-6 roll with turn management.
3. **Piece movement** — validates and executes moves on the board.
4. **Move validation** — computes legal moves, captures, and win conditions.
5. **Board mapping** — translates step numbers to board positions and detects safe zones.

---

## Files

| File | Role |
|------|------|
| `types.ts` | All type definitions: PlayerColor, GameState, Piece, LegalMove, MoveResult, GameEvent, etc. |
| `engine.ts` | Core LudoEngine class with rollDice(), movePiece(), and player lifecycle handlers |
| `move-validator.ts` | MoveValidator for legal move computation, capture resolution, and win checking |
| `board-mapper.ts` | BoardMapper for step-to-track-position translation and safe zone detection |
| `player-handler.ts` | Player lifecycle: disconnect with grace period, reconnect, ready, exit/forfeit |

---

## Key Types / Interfaces

### PlayerColor

```typescript
enum PlayerColor {
  red = 'red',
  blue = 'blue',
  green = 'green',
  yellow = 'yellow',
}
```

### Piece

```typescript
interface Piece {
  id: string;           // Unique piece identifier (e.g. "red-0", "red-1")
  color: PlayerColor;
  position: number;     // -1 = in base, 0-55 = on track, 56+ = in goal
  isInGoal: boolean;
  isInBase: boolean;
}
```

### GameState

```typescript
interface GameState {
  gameId: string;
  players: PlayerMeta[];
  pieces: Piece[];
  currentTurn: PlayerColor;
  diceValue: number | null;
  phase: 'waiting' | 'rolling' | 'moving' | 'clash' | 'finished';
  winner: PlayerColor | null;
  turnOrder: PlayerColor[];
  moveHistory: MoveRecord[];
  startedAt: number;
  lastMoveAt: number;
}
```

### LegalMove

```typescript
interface LegalMove {
  pieceId: string;
  from: number;
  to: number;
  captures: string[];   // IDs of captured opponent pieces
  entersGoal: boolean;
  entersHomeStretch: boolean;
  leavesBase: boolean;
}
```

### MoveResult

```typescript
interface MoveResult {
  success: boolean;
  gameState: GameState;
  events: GameEvent[];
  clash?: ClashState;   // If a capture triggers a clash
}
```

### GameEvent

```typescript
type GameEvent =
  | { type: 'dice_rolled'; player: PlayerColor; value: number }
  | { type: 'piece_moved'; pieceId: string; from: number; to: number }
  | { type: 'piece_captured'; pieceId: string; capturedBy: string }
  | { type: 'piece_entered_goal'; pieceId: string }
  | { type: 'piece_left_base'; pieceId: string }
  | { type: 'clash_started'; attacker: string; defender: string }
  | { type: 'clash_resolved'; winner: string; loser: string }
  | { type: 'game_won'; winner: PlayerColor }
  | { type: 'player_disconnected'; player: PlayerColor }
  | { type: 'player_reconnected'; player: PlayerColor };
```

---

## Core Logic / Flow

### 1. Dice Roll

Sequence of steps when a player rolls the dice on their turn.
```mermaid
sequenceDiagram
    participant Client
    participant Engine as LudoEngine
    participant Validator as MoveValidator

    Client->>Engine: rollDice(gameId, playerColor)
    Engine->>Engine: Verify it's player's turn
    alt Not player's turn
        Engine-->>Client: error: "Not your turn"
    end
    Engine->>Engine: Generate random 1-6
    Engine->>Validator: getLegalMoves(gameState, diceValue)
    Validator->>Validator: For each piece, compute valid moves
    Validator-->>Engine: [LegalMove]
    alt No legal moves
        Engine->>Engine: Auto pass turn to next player
        Engine-->>Client: { diceValue, legalMoves: [], turnPassed: true }
    else Has legal moves
        Engine-->>Client: { diceValue, legalMoves: [...] }
    end
```

### 2. Piece Movement

Sequence of steps when a player moves a piece to a target position.
```mermaid
sequenceDiagram
    participant Client
    participant Engine as LudoEngine
    participant Validator as MoveValidator
    participant Clash as ClashManager

    Client->>Engine: movePiece(gameId, pieceId)
    Engine->>Engine: Verify it's player's turn
    Engine->>Validator: isMoveLegal(gameState, pieceId, diceValue)
    alt Illegal move
        Validator-->>Engine: false
        Engine-->>Client: error: "Illegal move"
    end
    Engine->>Engine: Execute move (update piece position)
    Engine->>Validator: checkCaptures(newPosition)
    alt Capture occurred
        Validator-->>Engine: [capturedPieceIds]
        Engine->>Clash: startClash(attacker, defender)
        Clash-->>Engine: ClashState
        Engine-->>Client: { success: true, clash: ClashState }
    else No capture
        Engine->>Validator: checkWinCondition()
        alt Player won
            Engine->>Engine: Set phase = 'finished', winner
            Engine-->>Client: { success: true, gameWon: true, winner }
        else Game continues
            Engine->>Engine: Advance turn to next player
            Engine-->>Client: { success: true, nextTurn }
        end
    end
```

### 3. Game Lifecycle

Sequence of steps showing the full lifecycle of a game from start to finish.
```mermaid
sequenceDiagram
    participant Engine as LudoEngine
    participant Lobby as LobbyManager
    participant Validator as MoveValidator

    Note over Engine,Validator: Phase 1: Setup
    Lobby->>Engine: startGame(players, colors)
    Engine->>Engine: Initialize GameState
    Engine->>Engine: Place all pieces in base (position = -1)
    Engine->>Engine: Set turnOrder, currentTurn = first player
    Engine-->>Lobby: GameState (phase: 'waiting')

    Note over Engine,Validator: Phase 2: Playing
    loop Each turn
        Engine->>Engine: rollDice()
        Engine->>Validator: getLegalMoves()
        alt Has moves
            Engine->>Engine: movePiece()
            Engine->>Validator: checkCaptures()
            alt Capture
                Engine->>Engine: startClash()
            end
            Engine->>Validator: checkWinCondition()
        else No moves
            Engine->>Engine: Pass turn
        end
    end

    Note over Engine,Validator: Phase 3: Finished
    Engine->>Engine: Set winner, phase = 'finished'
    Engine-->>Lobby: GameState (phase: 'finished', winner)
```

---

## Logic Paths Summary

### Dice Roll Path
```
rollDice(gameId, playerColor)
  ├── Verify turn ownership → error if not player's turn
  ├── Generate random 1-6
  ├── Compute legal moves for all pieces
  │   ├── No legal moves → auto pass turn, return { diceValue, turnPassed: true }
  │   └── Has legal moves → return { diceValue, legalMoves: [...] }
```

### Move Piece Path
```
movePiece(gameId, pieceId)
  ├── Verify turn ownership → error if not player's turn
  ├── Validate move legality → error if illegal
  ├── Execute move (update piece position)
  ├── Check for captures
  │   ├── Capture detected → start clash minigame
  │   └── No capture → continue
  ├── Check win condition
  │   ├── All pieces in goal → game won
  │   └── Not won → advance turn
  └── Return MoveResult
```

### Move Validation Path
```
getLegalMoves(gameState, diceValue)
  For each piece of current player:
    ├── Piece in base:
    │   ├── diceValue = 6 → can leave base (position = start)
    │   └── diceValue ≠ 6 → no move
    ├── Piece on track:
    │   ├── Calculate new position = current + diceValue
    │   ├── Check if new position is within board bounds
    │   ├── Check if new position is safe zone (no capture)
    │   ├── Check if new position has own piece → blocked
    │   ├── Check if new position has opponent piece → capture possible
    │   └── Check if new position enters goal stretch
    └── Piece in goal → no move
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| (none) | Core engine has no external dependencies — pure TypeScript logic |
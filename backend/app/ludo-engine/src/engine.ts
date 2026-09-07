import { GameState, PlayerColor, LegalMove, MoveResult, MovePieceOutput, PieceId, GameEvent } from './types';
import { RedisGameStore } from './redis';
import { MoveValidator } from './move-validator';
import { applyMoveOutcome } from './turn';
import { advanceTurnInState } from './player-handler';
import {
  handlePlayerDisconnect,
  handlePlayerReconnect,
  handlePlayerReady,
  handlePlayerExit,
  handlePlayerResign,
} from './player-handler';
import { LobbyManager } from './lobby';

// The game engine core: roll/move handling, per-game operation locking,
// player lifecycle (disconnect/ready/exit/resign), and event emission to the
// socket layer. Instantiated by socket/server.ts.
export class LudoEngine {
  // Redis-backed persistence for game states and move history.
  private store: RedisGameStore;
  private eventHandler?: (event: GameEvent) => void;
  private lobbyManager?: LobbyManager;
  // Serializes one game's operations so roll/move/etc. never run on top of
  // each other (a bot acting at the same time as a human would otherwise
  // both load the same state and one move gets lost).
  private gameLocks = new Map<string, Promise<unknown>>();

  constructor(store: RedisGameStore) {
    this.store = store;
  }

  setLobbyManager(lobbyManager: LobbyManager): void {
    this.lobbyManager = lobbyManager;
  }

  // Register a callback for game lifecycle events.
  // This is the single source of truth : the socket layer should NOT
  // independently detect game end, publish events, etc.
  onEvent(handler: (event: GameEvent) => void): void {
    this.eventHandler = handler;
  }

  private emit(event: GameEvent): void {
    this.eventHandler?.(event);
  }

  // Public wrapper for emitting engine events (used by socket handlers).
  emitEvent(event: GameEvent): void {
    this.emit(event);
  }

  // Serialize a mutating operation per game: the next operation for a game
  // only starts after the previous one resolved (or rejected) against Redis.
  private withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.gameLocks.get(gameId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.gameLocks.set(gameId, run.then(() => undefined, () => undefined));
    return run;
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    return await this.store.loadGameState(gameId);
  }

  // Roll dice for the current player.
  // Sets turnPhase to WAITING_FOR_MOVE and stores pendingLegalMoves and pendingDiceValue.
  // Handles zero legal moves by advancing turn automatically (with bonus roll on 6).
  async rollDice(gameId: string): Promise<{ value: number; legalMoves: LegalMove[]; bonusRoll: boolean }> {
    return this.withGameLock(gameId, async () => {
    const state = await this.store.loadGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    // Only allow roll during WAITING_FOR_ROLL phase
    if (state.turnPhase !== 'WAITING_FOR_ROLL' && state.turnPhase !== undefined) {
      throw new Error('Invalid turn phase: expected WAITING_FOR_ROLL');
    }

    const currentPlayer = state.players.find(p => p.color === state.currentTurn);
    if (!currentPlayer || currentPlayer.status === 'exited') {
      throw new Error('Current player has exited');
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;

    currentPlayer.hasRolled = true;
    // Per-player 6-streak (classic rule): every 6 grants a bonus roll; the
    // third consecutive 6 forfeits the turn. Lives on PlayerMeta so it
    // resets on turn advance.
    currentPlayer.consecutiveSixes = diceValue === 6 ? currentPlayer.consecutiveSixes + 1 : 0;

    if (diceValue === 6) {
      if (currentPlayer.consecutiveSixes >= 3) {
        currentPlayer.consecutiveSixes = 0;
        currentPlayer.bonusRoll = false;
        state.turnPhase = 'WAITING_FOR_ROLL';
        state.pendingLegalMoves = [];
        state.pendingDiceValue = undefined;
        state.pendingIsFirstRoll = undefined;
        advanceTurnInState(state);
        await this.store.saveGameState(gameId, state);
        this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: false, currentTurn: state.currentTurn, forfeited: true });
        return { value: diceValue, legalMoves: [], bonusRoll: false };
      }
    }

    const sixBonus = diceValue === 6;
    currentPlayer.bonusRoll = sixBonus;

    const legalMoves = MoveValidator.getLegalMoves(state, state.currentTurn, diceValue);

    // Store authoritative dice value so movePiece() doesn't need to recompute it
    state.pendingDiceValue = diceValue;

    if (legalMoves.length === 0) {
      // No legal moves: auto-advance turn (with bonus roll only on a first-roll 6)
      state.pendingLegalMoves = [];
      if (sixBonus) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
      await this.store.saveGameState(gameId, state);
      this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: sixBonus, currentTurn: state.currentTurn });
      return { value: diceValue, legalMoves: [], bonusRoll: sixBonus };
    }

    // Set turn phase and store pending legal moves (server-authoritative)
    state.turnPhase = 'WAITING_FOR_MOVE';
    state.pendingLegalMoves = legalMoves;

    await this.store.saveGameState(gameId, state);

    this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves, bonusRoll: sixBonus, currentTurn: state.currentTurn });
    return { value: diceValue, legalMoves, bonusRoll: sixBonus };
    });
  }

  // Move a piece: validate against pendingLegalMoves (server-authoritative),
  // apply using the stored pendingDiceValue, and return result + state.
  async movePiece(gameId: string, pieceId: PieceId): Promise<MovePieceOutput> {
    return this.withGameLock(gameId, async () => {
    const state = await this.store.loadGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    // Validate: must be in WAITING_FOR_MOVE phase
    if (state.turnPhase !== 'WAITING_FOR_MOVE') {
      throw new Error('Invalid turn phase: expected WAITING_FOR_MOVE');
    }

    // Validate: pieceId must be in pendingLegalMoves. The list is a snapshot
    // from roll time : a disconnect/forfeit between roll and move is rejected
    // here. We intentionally do NOT re-derive the capture; the snapshot is
    // the contract.
    const pendingMove = state.pendingLegalMoves.find(m => m.pieceId === pieceId);
    if (!pendingMove) {
      throw new Error('Invalid move: piece not in legal moves');
    }

    // Use the server-authoritative dice value
    const diceValue = state.pendingDiceValue;
    if (diceValue === undefined) {
      throw new Error('No pending dice value : roll first');
    }

    // Execute move via MoveValidator (pure game logic)
    const result = MoveValidator.executeMove(state, pendingMove, diceValue);

    // Sync frontend-compatible piece fields
    const movedPiece = state.pieces.find(p => p.id === pieceId);
    if (movedPiece) {
      movedPiece.isInGoal = result.to === 57;
      movedPiece.isInBase = result.to <= 0;
    }
    if (result.captured && result.capturedPieceIds) {
      for (const id of result.capturedPieceIds) {
        const capturedPiece = state.pieces.find(p => p.id === id);
        if (capturedPiece) {
          capturedPiece.isInGoal = false;
          capturedPiece.isInBase = true;
        }
      }
    }

    // Record move history
    await this.store.recordMove(gameId, {
      ply: result.ply,
      color: result.color,
      diceValue: result.diceValue,
      pieceId: result.pieceId,
      from: result.from,
      to: result.to,
      captured: result.captured,
      enteredHome: result.enteredHome,
      timestamp: Date.now()
    });

    // Apply the move outcome: sync piece mirrors, bump the counter, run the
    // win check, update stats/bonus, and hand off the turn (or re-roll on a
    // 6/capture). Returns the winner if the game just finished.
    const winner = applyMoveOutcome(state, result, diceValue);

    await this.store.saveGameState(gameId, state);

    this.emit({ type: 'piece_moved', gameId, result });
    if (winner) {
      this.emit({ type: 'game_ended', gameId, winner, resultDetail: 'four_pieces' });
    }

    return { result, state };
    });
  }


  // Player lifecycle handlers (delegated to player-handler.ts)
  async handlePlayerDisconnect(gameId: string, color: PlayerColor, notifyAbort?: (gameId: string) => void): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerDisconnect(this.store, (e) => this.emit(e), gameId, color, notifyAbort));
  }

  async handlePlayerReconnect(gameId: string, color: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerReconnect(this.store, gameId, color));
  }

  async handlePlayerReady(gameId: string, color: PlayerColor): Promise<void> {
    await this.withGameLock(gameId, () => handlePlayerReady(this.store, (e) => this.emit(e), gameId, color));
    await this.emitLobbyUpdate(gameId);
  }

  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerExit(this.store, (e) => this.emit(e), gameId, color));
  }

  async handlePlayerResign(gameId: string, color: PlayerColor): Promise<void> {
    return this.withGameLock(gameId, () => handlePlayerResign(this.store, (e) => this.emit(e), gameId, color));
  }

  async handlePlayerSelectColor(gameId: string, userId: string, color: PlayerColor): Promise<void> {
    if (!this.lobbyManager) {
      throw new Error('Lobby manager not initialized');
    }
    await this.withGameLock(gameId, () => this.lobbyManager!.handleSelectColor(gameId, userId, color));
    await this.emitLobbyUpdate(gameId);
  }

  // Broadcast the waiting-room roster so every client's lobby stays in sync
  // after ready-toggles, color swaps, or joins. socket-handlers.ts calls
  // this after join_game.
  async emitLobbyUpdate(gameId: string): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;
    const players = state.players
      .filter(p => p.status !== 'inactive')
      .map(p => ({
        userId: '',
        username: p.username,
        avatarStyle: '',
        color: p.color,
        ready: state.readyPlayers.includes(p.color),
      }));
    this.emit({ type: 'lobby_update', gameId, players });
  }
}

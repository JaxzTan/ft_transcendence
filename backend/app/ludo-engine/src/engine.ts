import { GameState, PlayerColor, LegalMove, MoveResult, MovePieceOutput, PieceId, GameEvent } from './types';
import { RedisGameStore } from './redis';
import { MoveValidator } from './move-validator';
import { ClashManager } from './clash';
import { advanceTurnInState } from './player-handler';
import {
  handlePlayerDisconnect,
  handlePlayerReconnect,
  handlePlayerReady,
  handlePlayerExit,
} from './player-handler';
import { LobbyManager } from './lobby';

export class LudoEngine {
  private store: RedisGameStore;
  private eventHandler?: (event: GameEvent) => void;
  private clashManager: ClashManager;
  private lobbyManager?: LobbyManager;

  constructor(store: RedisGameStore, clashManager: ClashManager) {
    this.store = store;
    this.clashManager = clashManager;
  }

  setLobbyManager(lobbyManager: LobbyManager): void {
    this.lobbyManager = lobbyManager;
  }

  /**
   * Register a callback for game lifecycle events.
   * This is the single source of truth — the socket layer should NOT
   * independently detect game end, publish events, etc.
   */
  onEvent(handler: (event: GameEvent) => void): void {
    this.eventHandler = handler;
  }

  private emit(event: GameEvent): void {
    this.eventHandler?.(event);
  }

  /** Public wrapper for emitting engine events (used by socket handlers). */
  emitEvent(event: GameEvent): void {
    this.emit(event);
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    return await this.store.loadGameState(gameId);
  }

  /**
   * Roll dice for the current player.
   * Sets turnPhase to WAITING_FOR_MOVE and stores pendingLegalMoves and pendingDiceValue.
   * Handles zero legal moves by advancing turn automatically (with bonus roll on 6).
   */
  async rollDice(gameId: string): Promise<{ value: number; legalMoves: LegalMove[]; bonusRoll: boolean }> {
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
    // Only the first roll of a turn-holding streak can earn a six-bonus;
    // any roll after that (including a bonus roll that itself lands a 6)
    // needs an actual capture to keep the turn going.
    const isFirstRoll = state.firstRollOfTurn;
    state.firstRollOfTurn = false;

    currentPlayer.hasRolled = true;
    currentPlayer.consecutiveSixes = diceValue === 6 ? state.consecutiveSixes : 0;

    // Handle three consecutive sixes: forfeit turn
    if (diceValue === 6) {
      state.consecutiveSixes++;
      if (state.consecutiveSixes >= 3) {
        state.consecutiveSixes = 0;
        currentPlayer.bonusRoll = false;
        state.turnPhase = 'WAITING_FOR_ROLL';
        state.pendingLegalMoves = [];
        state.pendingDiceValue = undefined;
        state.pendingIsFirstRoll = undefined;
        advanceTurnInState(state);
        await this.store.saveGameState(gameId, state);
        this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: false, currentTurn: state.currentTurn });
        return { value: diceValue, legalMoves: [], bonusRoll: false };
      }
    } else {
      state.consecutiveSixes = 0;
    }

    const sixBonus = diceValue === 6 && isFirstRoll;
    currentPlayer.bonusRoll = sixBonus;

    const legalMoves = MoveValidator.getLegalMoves(state, state.currentTurn, diceValue);

    // Store authoritative dice value + first-roll status so movePiece() doesn't need to recompute it
    state.pendingDiceValue = diceValue;
    state.pendingIsFirstRoll = isFirstRoll;

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
  }

  /**
   * Move a piece. Validates against pendingLegalMoves for server-authoritativeness.
   * Uses pendingDiceValue from state instead of requiring it as a parameter.
   * Returns both the MoveResult and the updated GameState to avoid extra Redis loads.
   * Emits game lifecycle events as the single source of truth.
   */
  async movePiece(gameId: string, pieceId: PieceId): Promise<MovePieceOutput> {
    const state = await this.store.loadGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    // Validate: must be in WAITING_FOR_MOVE phase
    if (state.turnPhase !== 'WAITING_FOR_MOVE') {
      throw new Error('Invalid turn phase: expected WAITING_FOR_MOVE');
    }

    // Validate: pieceId must be in pendingLegalMoves (server-authoritative)
    const pendingMove = state.pendingLegalMoves.find(m => m.pieceId === pieceId);
    if (!pendingMove) {
      throw new Error('Invalid move: piece not in legal moves');
    }

    // Use the server-authoritative dice value
    const diceValue = state.pendingDiceValue;
    if (diceValue === undefined) {
      throw new Error('No pending dice value — roll first');
    }
    const rollWasFirst = state.pendingIsFirstRoll === true;

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

    // Increment move counter
    state.moveCounter++;

    // Check win
    const winner = MoveValidator.checkWinner(state);
    
    if (winner) {
      const piecesInGoal = MoveValidator.countPiecesInGoal(state, winner);
      const winnerPlayer = state.players.find(p => p.color === winner);
      if (winnerPlayer) {
        winnerPlayer.stats.piecesInGoal = piecesInGoal;
        winnerPlayer.piecesInGoal = piecesInGoal;
        winnerPlayer.isFinished = true;
        winnerPlayer.finishedAt = new Date().toISOString();
      }
      state.status = 'finished';
      state.winner = winner;
      state.resultDetail = 'four_pieces';
    } else {
      // Sync piecesInGoal for the moving player
      const mover = state.players.find(p => p.color === result.color);
      const sixBonus = diceValue === 6 && rollWasFirst;
      if (mover) {
        mover.piecesInGoal = MoveValidator.countPiecesInGoal(state, result.color);
        mover.hasRolled = false;
        mover.bonusRoll = sixBonus || result.captured;
      }
      // Bonus roll on a first-roll 6 or an actual capture: same player rolls again
      // Otherwise, advance turn to next player
      if (sixBonus || result.captured) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
    }

    // Clear pending moves and dice value after move is processed
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;
    state.pendingIsFirstRoll = undefined;

    await this.store.saveGameState(gameId, state);

    this.emit({ type: 'piece_moved', gameId, result });
    if (winner) {
      this.emit({ type: 'game_ended', gameId, winner, resultDetail: 'four_pieces' });
    }

    return { result, state };
  }


  // ─── Player lifecycle handlers (delegated to player-handler.ts) ─────────────

  async handlePlayerDisconnect(gameId: string, color: PlayerColor): Promise<void> {
    return handlePlayerDisconnect(this.store, (e) => this.emit(e), gameId, color, this.clashManager);
  }

  async handlePlayerReconnect(gameId: string, color: PlayerColor): Promise<void> {
    return handlePlayerReconnect(this.store, gameId, color);
  }

  async handlePlayerReady(gameId: string, color: PlayerColor): Promise<void> {
    await handlePlayerReady(this.store, (e) => this.emit(e), gameId, color);
    await this.emitLobbyUpdate(gameId);
  }

  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    return handlePlayerExit(this.store, (e) => this.emit(e), gameId, color);
  }

  async handlePlayerSelectColor(gameId: string, userId: string, color: PlayerColor): Promise<void> {
    if (!this.lobbyManager) {
      throw new Error('Lobby manager not initialized');
    }
    await this.lobbyManager.handleSelectColor(gameId, userId, color);
    await this.emitLobbyUpdate(gameId);
  }

  /**
   * Broadcast the current waiting-room roster (seat, username, ready flag) so every
   * connected client's lobby screen stays in sync after a ready-toggle, color swap,
   * or a new player joining. Public: socket-handlers.ts calls this after join_game
   * so already-connected clients learn about the new seat (see handleJoinGame).
   */
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

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

    // Handle three consecutive sixes: forfeit turn
    if (diceValue === 6) {
      state.consecutiveSixes++;
      if (state.consecutiveSixes >= 3) {
        state.consecutiveSixes = 0;
        state.turnPhase = 'WAITING_FOR_ROLL';
        state.pendingLegalMoves = [];
        state.pendingDiceValue = undefined;
        advanceTurnInState(state);
        await this.store.saveGameState(gameId, state);
        this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll: false });
        return { value: diceValue, legalMoves: [], bonusRoll: false };
      }
    } else {
      state.consecutiveSixes = 0;
    }

    const legalMoves = MoveValidator.getLegalMoves(state, state.currentTurn, diceValue);

    // Store authoritative dice value so movePiece() doesn't need it recomputed
    state.pendingDiceValue = diceValue;
    
    if (legalMoves.length === 0) {
      // No legal moves: auto-advance turn (with bonus roll on 6)
      state.pendingLegalMoves = [];
      const bonusRoll = diceValue === 6;
      if (bonusRoll) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
      await this.store.saveGameState(gameId, state);
      this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves: [], bonusRoll });
      return { value: diceValue, legalMoves: [], bonusRoll };
    }

    // Set turn phase and store pending legal moves (server-authoritative)
    state.turnPhase = 'WAITING_FOR_MOVE';
    state.pendingLegalMoves = legalMoves;
    
    await this.store.saveGameState(gameId, state);
    
    const bonusRoll = diceValue === 6;
    this.emit({ type: 'dice_rolled', gameId, value: diceValue, legalMoves, bonusRoll });
    return { value: diceValue, legalMoves, bonusRoll };
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

    // Execute move via MoveValidator (pure game logic)
    const result = MoveValidator.executeMove(state, pendingMove, diceValue);

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
      }
      state.status = 'finished';
      state.winner = winner;
      state.resultDetail = 'four_pieces';
    } else {
      // Bonus roll on 6 or capture: same player rolls again
      // Otherwise, advance turn to next player
      if (diceValue === 6 || result.captured) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        advanceTurnInState(state);
      }
    }

    // Clear pending moves and dice value after move is processed
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;

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
    return handlePlayerReady(this.store, (e) => this.emit(e), gameId, color);
  }

  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    return handlePlayerExit(this.store, (e) => this.emit(e), gameId, color);
  }

  async handlePlayerSelectColor(gameId: string, userId: string, color: PlayerColor): Promise<void> {
    if (!this.lobbyManager) {
      throw new Error('Lobby manager not initialized');
    }
    await this.lobbyManager.handleSelectColor(gameId, userId, color);
  }
}

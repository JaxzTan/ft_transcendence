import { GameState, PlayerColor, LegalMove, MoveResult, MovePieceOutput, PieceId, GameEvent, DisconnectState } from './types';
import { RedisGameStore } from './redis';
import { BoardMapper } from './board-mapper';

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
const DISCONNECT_GRACE_MS = 30000; // 30 seconds to reconnect before forfeit

/**
 * MoveValidator - determines legal moves for a given dice roll.
 * Extracted for separation of concerns.
 */
export class MoveValidator {
  static getLegalMoves(state: GameState, color: PlayerColor, diceValue: number): LegalMove[] {
    const moves: LegalMove[] = [];
    
    for (const piece of state.pieces.filter(p => p.color === color)) {
      const from = piece.step;
      
      // Skip if exited (step < 0)
      if (from < 0) continue;
      
      // Skip if already finished (step === 57)
      if (from === 57) continue;
      
      // Prison exit rule: can only leave prison on a roll of 6
      if (from === 0 && diceValue !== 6) continue;
      
      const to = from + diceValue;
      if (to > 57) continue; // overshoot
      
      const isHomeEntry = to >= 52 && to <= 56;
      const isCapture = this.wouldCaptureStatic(state, color, piece.id, to);
      
      moves.push({
        pieceId: piece.id,
        from,
        to,
        isCapture,
        isHomeEntry
      });
    }
    
    return moves;
  }

  static wouldCaptureStatic(state: GameState, excludeColor: PlayerColor, pieceId: PieceId, targetStep: number): boolean {
    if (targetStep <= 0 || targetStep >= 57) return false;
    
    // Check safe zones using BoardMapper (safe zones are track positions 8, 13, 21, 26, 34, 39, 47)
    if (BoardMapper.isSafeZoneStep(pieceId, targetStep)) return false;

    for (const piece of state.pieces) {
      if (piece.color === excludeColor || piece.step < 0) continue;
      const boardPos = BoardMapper.toTrackPosition(piece.id, piece.step);
      const targetPos = BoardMapper.toTrackPosition(pieceId, targetStep);
      if (boardPos === targetPos) return true;
    }
    return false;
  }

  static findPieceAtPosition(state: GameState, excludeColor: PlayerColor, targetStep: number): PieceId | undefined {
    if (targetStep <= 0 || targetStep >= 52) return undefined;
    
    for (const piece of state.pieces) {
      if (piece.color === excludeColor || piece.step < 0) continue;
      
      const boardPos = BoardMapper.toTrackPosition(piece.id, piece.step);
      const targetPos = BoardMapper.toTrackPosition(`${excludeColor}-0`, targetStep);
      if (boardPos === targetPos) return piece.id;
    }
    return undefined;
  }
}

/**
 * WinRules - determines win conditions.
 */
export class WinRules {
  static checkWinner(state: GameState): PlayerColor | null {
    for (const player of state.players) {
      const playerPieces = state.pieces.filter(p => p.color === player.color);
      if (playerPieces.every(p => p.step === 57)) {
        return player.color;
      }
    }
    return null;
  }
}

export class LudoEngine {
  private store: RedisGameStore;
  private eventHandler?: (event: GameEvent) => void;

  constructor(store: RedisGameStore) {
    this.store = store;
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

  async initializeGame(gameId: string, clashMode: boolean): Promise<void> {
    await this.store.createGame(gameId, clashMode);
  }

  async addPlayer(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;
    
    const player = state.players.find(p => p.color === color);
    if (player) {
      player.status = 'active';
      await this.store.saveGameState(gameId, state);
    }
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
        this.advanceTurnInState(state);
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
        this.advanceTurnInState(state);
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

    const piece = state.pieces.find(p => p.id === pieceId);
    if (!piece || piece.step < 0) {
      throw new Error('Piece not found or inactive');
    }

    // Validate: piece color matches current turn
    if (piece.color !== state.currentTurn) {
      throw new Error('Not your turn');
    }

    // Use the server-authoritative dice value
    const diceValue = state.pendingDiceValue;
    if (diceValue === undefined) {
      throw new Error('No pending dice value — roll first');
    }

    const from = piece.step;
    const to = pendingMove.to; // Use validated to, not from+diceValue

    const isCapture = pendingMove.isCapture;
    const enteredHome = pendingMove.isHomeEntry;

    piece.step = to;

    // Update player stats
    const player = state.players.find(p => p.color === piece.color);
    if (player) {
      player.stats.turns++;
    }

    // Record move history
    await this.store.recordMove(gameId, {
      ply: state.moveCounter + 1,
      color: piece.color,
      diceValue,
      pieceId,
      from,
      to,
      captured: isCapture,
      enteredHome,
      timestamp: Date.now()
    });

    // Track captured piece ID
    let capturedPieceId: PieceId | undefined;
    if (isCapture) {
      capturedPieceId = MoveValidator.findPieceAtPosition(state, piece.color, to);
      if (capturedPieceId) {
        const capturedPiece = state.pieces.find(p => p.id === capturedPieceId);
        if (capturedPiece) {
          capturedPiece.step = 0; // Send to prison
        }
        const capturer = state.players.find(p => p.color === piece.color);
        if (capturer) {
          capturer.stats.captures++;
        }
      }
    }

    // Increment move counter
    state.moveCounter++;

    // Check win
    const winner = WinRules.checkWinner(state);
    
    if (winner) {
      for (const player of state.players) {
        const piecesInGoal = state.pieces.filter(p => p.color === player.color && p.step === 57).length;
        player.stats.piecesInGoal = piecesInGoal;
      }
      state.status = 'finished';
      state.winner = winner;
      state.resultDetail = 'four_pieces';
    } else {
      // Bonus roll on 6 or capture: same player rolls again
      // Otherwise, advance turn to next player
      if (diceValue === 6 || isCapture) {
        state.turnPhase = 'WAITING_FOR_ROLL';
      } else {
        state.turnPhase = 'WAITING_FOR_ROLL';
        this.advanceTurnInState(state);
      }
    }

    // Clear pending moves and dice value after move is processed
    state.pendingLegalMoves = [];
    state.pendingDiceValue = undefined;

    await this.store.saveGameState(gameId, state);

    const result: MoveResult = {
      ply: state.moveCounter,
      color: piece.color,
      diceValue,
      pieceId,
      from,
      to,
      captured: isCapture,
      capturedPieceId,
      enteredHome,
      bonusRoll: !winner && (diceValue === 6 || isCapture)
    };

    // Emit events — single source of truth
    this.emit({ type: 'piece_moved', gameId, result });
    if (winner) {
      this.emit({ type: 'game_ended', gameId, winner, resultDetail: 'four_pieces' });
    }

    return { result, state };
  }

  private advanceTurnInState(state: GameState): void {
    const currentIndex = COLORS.indexOf(state.currentTurn);
    let nextIndex = (currentIndex + 1) % 4;
    
    let loopCount = 0;
    while (loopCount < 4) {
      const p = state.players[nextIndex];
      // Skip exited and temporarily disconnected players
      if (p.status !== 'exited' && p.status !== 'disconnected') {
        break;
      }
      nextIndex = (nextIndex + 1) % 4;
      loopCount++;
    }

    if (loopCount >= 4) {
      state.status = 'finished';
    }
    state.currentTurn = COLORS[nextIndex];
  }

  /**
   * Handle a player disconnect with a grace period.
   * Instead of immediately exiting, marks the player as 'disconnected'
   * and schedules a forfeit after DISCONNECT_GRACE_MS.
   * If the player reconnects within the window, the disconnect is cleared.
   */
  async handlePlayerDisconnect(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;

    // Check if already disconnected
    const existing = state.disconnectedPlayers.find(d => d.color === color);
    if (existing) return; // Already in grace period

    const deadline = Date.now() + DISCONNECT_GRACE_MS;
    state.disconnectedPlayers.push({
      color,
      disconnectedAt: Date.now(),
      reconnectDeadline: deadline,
    });

    // Mark player as disconnected (not exited — they can still reconnect)
    const player = state.players.find(p => p.color === color);
    if (player && player.status === 'active') {
      player.status = 'disconnected';
    }

    // If it's this player's turn, advance to next active player
    if (state.currentTurn === color && state.status === 'active') {
      this.advanceTurnInState(state);
      // Clear any pending moves from the disconnected player
      state.pendingLegalMoves = [];
      state.pendingDiceValue = undefined;
    }

    await this.store.saveGameState(gameId, state);
    this.emit({ type: 'player_exited', gameId, color });

    // Schedule forfeit after grace period
    setTimeout(async () => {
      const currentState = await this.store.loadGameState(gameId);
      if (!currentState) return;

      const disc = currentState.disconnectedPlayers.find(d => d.color === color);
      if (!disc) return; // Already reconnected

      // Check if deadline has passed
      if (Date.now() >= disc.reconnectDeadline) {
        // Forfeit: permanently exit the player
        await this.handlePlayerExit(gameId, color);
      }
    }, DISCONNECT_GRACE_MS + 1000);
  }

  /**
   * Handle a player reconnecting within the grace period.
   */
  async handlePlayerReconnect(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;

    const discIndex = state.disconnectedPlayers.findIndex(d => d.color === color);
    if (discIndex === -1) return; // Not in grace period

    const disc = state.disconnectedPlayers[discIndex];
    if (Date.now() > disc.reconnectDeadline) {
      // Too late — player is already forfeited
      return;
    }

    // Remove from disconnect list
    state.disconnectedPlayers.splice(discIndex, 1);

    // Restore player to active
    const player = state.players.find(p => p.color === color);
    if (player) {
      player.status = 'active';
    }

    await this.store.saveGameState(gameId, state);
  }

  /**
   * Permanently exit a player (forfeit).
   * Sets all pieces to -1, marks player as exited.
   */
  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.store.loadGameState(gameId);
    if (!state) return;

    // Remove from disconnect list if present
    state.disconnectedPlayers = state.disconnectedPlayers.filter(d => d.color !== color);

    for (const piece of state.pieces.filter(p => p.color === color)) {
      piece.step = -1;
    }
    
    const player = state.players.find(p => p.color === color);
    if (player) {
      player.status = 'exited';
    }

    if (state.currentTurn === color && state.status === 'active') {
      this.advanceTurnInState(state);
    }
    
    // Clear any pending clash state on exit
    if (state.clash) {
      delete state.clash;
    }
    
    await this.store.saveGameState(gameId, state);
    this.emit({ type: 'player_exited', gameId, color });
  }
}
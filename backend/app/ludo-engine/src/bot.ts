import { LudoEngine } from './engine';
import { RedisGameStore } from './redis';
import { BoardMapper } from './board-mapper';
import type { PlayerColor, PieceId, GameState, LegalMove } from './types';

/**
 * Server-side Ludo Bot with heuristic-based move selection.
 * Each bot (per color) analyzes the game state to decide moves.
 * Bot turns are scheduled by the SocketServer, not by the bot itself,
 * to prevent overlapping timers.
 */
export class LudoBot {
  private engine: LudoEngine;
  private store: RedisGameStore;
  private gameId: string;
  private color: PlayerColor;

  constructor(gameId: string, color: PlayerColor, engine: LudoEngine, store: RedisGameStore) {
    this.gameId = gameId;
    this.color = color;
    this.engine = engine;
    this.store = store;
  }

  /**
   * Select the best move using heuristics.
   * Priority order:
   * 1. Capture opponent pieces
   * 2. On roll 6, prefer freeing pieces from jail
   * 3. Enter home stretch (52+)
   * 4. Move to safe zones
   * 5. Maximum progress
   * 
   * Returns the LegalMove object for the best move.
   */
  selectBestMove(legalMoves: LegalMove[], state: GameState, diceValue: number): LegalMove | null {
    if (legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];

    // Priority 1: Capture moves - always take them
    const captures = legalMoves.filter(m => m.isCapture);
    if (captures.length > 0) {
      return captures[0];
    }

    // Priority 2: On a 6, prefer freeing pieces from jail (step 0)
    if (diceValue === 6) {
      const freesFromJail = legalMoves.filter(m => m.from === 0);
      if (freesFromJail.length > 0) {
        return freesFromJail[0];
      }
    }

    // Priority 3-5: Score remaining moves
    const scored = legalMoves.map(move => ({
      move,
      score: this.scoreMove(move)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  }

  /**
   * Score a move based on heuristics.
   * Higher score = better move.
   */
  private scoreMove(move: LegalMove): number {
    let score = 0;

    // Home entry is excellent
    if (move.isHomeEntry) {
      score += 1000;
    }

    // Safe zone bonus
    if (BoardMapper.isSafeZoneStep(move.pieceId, move.to)) {
      score += 500;
    }

    // Progress bonus (scaled)
    score += move.to * 10;

    // Moving from jail has slight bonus
    if (move.from === 0) {
      score += 100;
    }

    return score;
  }

  /**
   * Execute bot turn: roll dice and make the best move.
   * Does NOT schedule follow-up turns — the SocketServer handles that
   * via processBotTurn() to prevent overlapping timers.
   * Returns true if the game is still active after this turn.
   */
  async takeTurn(): Promise<boolean> {
    // Roll dice and publish event
    const { value: diceValue, legalMoves, bonusRoll } = await this.engine.rollDice(this.gameId);
    await this.store.publish(this.gameId, JSON.stringify({
      type: 'dice_rolled',
      value: diceValue,
      legalMoves,
      bonusRoll
    }));

    if (legalMoves.length > 0) {
      // Get current game state for heuristic analysis
      const state = await this.store.loadGameState(this.gameId);
      if (!state) return false;

      // Select best move using heuristics
      const bestMove = this.selectBestMove(legalMoves, state, diceValue);
      if (!bestMove) return false;
      
      // Execute move (engine reads diceValue from pendingDiceValue in state)
      const { result, state: updatedState } = await this.engine.movePiece(this.gameId, bestMove.pieceId);
      
      // Publish move event
      await this.store.publish(this.gameId, JSON.stringify({
        type: 'piece_moved',
        ...result
      }));

      // Check for win after bot move
      if (updatedState.status === 'finished') {
        await this.store.publish(this.gameId, JSON.stringify({
          type: 'game_ended',
          winner: updatedState.winner,
          resultDetail: updatedState.resultDetail
        }));
        return false; // Game finished
      }
    }

    return true; // Game still active
  }

  getGameId(): string {
    return this.gameId;
  }

  getColor(): PlayerColor {
    return this.color;
  }
}
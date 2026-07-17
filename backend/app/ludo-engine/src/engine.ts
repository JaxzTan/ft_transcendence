import { GameState, PlayerColor, PlayerStatus, LegalMove, MoveResult } from './types';
import { RedisGameStore } from './redis';

export class LudoEngine {
  private store: RedisGameStore;

  constructor(store: RedisGameStore) {
    this.store = store;
  }

  async initializeGame(gameId: string, clashMode: boolean): Promise<void> {
    await this.store.createGame(gameId, clashMode);
  }

  async addPlayer(gameId: string, color: PlayerColor): Promise<void> {
    await this.store.addPlayer(gameId, color);
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    return await this.store.getGameState(gameId);
  }

  async rollDice(gameId: string): Promise<{ value: number; legalMoves: LegalMove[]; bonusRoll: boolean }> {
    const state = await this.store.getGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    const currentPlayer = state.players[state.currentTurnIndex];
    if (currentPlayer.status !== 'active') {
      throw new Error('Current player has exited');
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;
    const legalMoves = await this.getLegalMoves(gameId, state.currentTurn, diceValue);

    // Update consecutive sixes
    if (diceValue === 6) {
      const count = await this.store.incrementConsecutiveSixes(gameId);
      if (count >= 3) {
        // Forfeit turn after 3 consecutive sixes
        await this.store.resetConsecutiveSixes(gameId);
        await this.advanceTurn(gameId);
        return { value: diceValue, legalMoves: [], bonusRoll: false };
      }
    } else {
      await this.store.resetConsecutiveSixes(gameId);
    }

    const bonusRoll = diceValue === 6 && legalMoves.length > 0;
    return { value: diceValue, legalMoves, bonusRoll };
  }

  async getLegalMoves(gameId: string, color: PlayerColor, diceValue: number): Promise<LegalMove[]> {
    const state = await this.store.getGameState(gameId);
    if (!state) return [];

    const player = state.players.find(p => p.color === color);
    if (!player || player.status !== 'active') return [];

    const moves: LegalMove[] = [];

    for (let i = 0; i < 4; i++) {
      const piece = player.pieces[i];
      const from = piece.progress;

      // Skip exited pieces
      if (from === -1) continue;

      const to = from + diceValue;
      if (to > 57) continue; // overshoot

      const isHomeEntry = to >= 52 && to <= 56;
      const isCapture = await this.wouldCapture(gameId, color, i, to);

      moves.push({
        pieceIndex: i,
        from,
        to,
        isCapture,
        isHomeEntry
      });
    }

    return moves;
  }

  private async wouldCapture(gameId: string, color: PlayerColor, pieceIndex: number, targetProgress: number): Promise<boolean> {
    const state = await this.store.getGameState(gameId);
    if (!state || targetProgress <= 0 || targetProgress >= 57) return false;

    const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];
    if (safeZones.includes(targetProgress)) return false;

    for (const player of state.players) {
      if (player.color === color || player.status !== 'active') continue;
      for (let i = 0; i < 4; i++) {
        const progress = await this.store.getPieceProgress(gameId, player.color, i);
        if (progress === targetProgress) return true;
      }
    }
    return false;
  }

  async movePiece(gameId: string, color: PlayerColor, pieceIndex: number, diceValue: number): Promise<MoveResult> {
    const state = await this.store.getGameState(gameId);
    if (!state || state.status !== 'active') {
      throw new Error('Game not active');
    }

    const from = await this.store.getPieceProgress(gameId, color, pieceIndex);
    const to = from + diceValue;
    if (to > 57) throw new Error('Invalid move: overshoot');

    const isCapture = await this.wouldCapture(gameId, color, pieceIndex, to);
    const enteredHome = to >= 52 && to <= 56;

    await this.store.updatePieceProgress(gameId, color, pieceIndex, to);
    await this.store.incrementPlayerTurn(gameId, color);

    let capturedColor: PlayerColor | undefined;
    if (isCapture) {
      capturedColor = await this.findPieceAtPosition(gameId, color, to);
      if (capturedColor) {
        await this.capturePiece(gameId, capturedColor, to);
        await this.store.incrementPlayerCapture(gameId, color);
      }
    }

    const ply = await this.calculatePly(gameId);
    const moveResult: MoveResult = {
      ply,
      color,
      diceValue,
      pieceIndex,
      from,
      to,
      captured: isCapture,
      capturedColor,
      enteredHome,
      bonusRoll: false
    };

    await this.store.recordMove(gameId, { ...moveResult, timestamp: Date.now() });

    // Check win
    const winner = await this.checkWinCondition(gameId);
    if (winner) {
      // Count piecesInGoal for winner and all players
      const state = await this.store.getGameState(gameId);
      if (state) {
        for (const player of state.players) {
          const allPieces = await Promise.all(
            player.pieces.map((_, idx) => this.store.getPieceProgress(gameId, player.color, idx))
          );
          const inGoal = allPieces.filter(p => p === 57).length;
          await this.store.setPlayerPiecesInGoal(gameId, player.color, inGoal);
        }
      }
      await this.store.setGameStatus(gameId, 'finished', winner, 'four_pieces');
      return moveResult;
    }

    moveResult.bonusRoll = (diceValue === 6 || isCapture) && !winner;
    if (!moveResult.bonusRoll) {
      await this.advanceTurn(gameId);
    }

    return moveResult;
  }

  private async capturePiece(gameId: string, color: PlayerColor, position: number): Promise<void> {
    const state = await this.store.getGameState(gameId);
    if (!state) return;

    const player = state.players.find((p) => p.color === color);
    if (!player || player.status !== 'active') return;

    for (let i = 0; i < 4; i++) {
      const progress = await this.store.getPieceProgress(gameId, color, i);
      if (progress === position) {
        await this.store.updatePieceProgress(gameId, color, i, 0); // send to prison
        break;
      }
    }
  }

  private async findPieceAtPosition(gameId: string, excludeColor: PlayerColor, position: number): Promise<PlayerColor | undefined> {
    const state = await this.store.getGameState(gameId);
    if (!state) return undefined;

    for (const player of state.players) {
      if (player.color === excludeColor || player.status !== 'active') continue;
      for (let i = 0; i < 4; i++) {
        const progress = await this.store.getPieceProgress(gameId, player.color, i);
        if (progress === position) return player.color;
      }
    }
    return undefined;
  }

  private async calculatePly(gameId: string): Promise<number> {
    const state = await this.store.getGameState(gameId);
    if (!state) return 0;
    
    let count = 0;
    for (const player of state.players) {
      for (let i = 0; i < 4; i++) {
        const progress = await this.store.getPieceProgress(gameId, player.color, i);
        if (progress > 0) count++;
      }
    }
    return count;
  }

  private async checkWinCondition(gameId: string): Promise<PlayerColor | undefined> {
    const state = await this.store.getGameState(gameId);
    if (!state) return undefined;

    for (const player of state.players) {
      if (player.status !== 'active') continue;
      const allHome = await Promise.all(
        player.pieces.map((_, idx) => this.store.getPieceProgress(gameId, player.color, idx))
      );
      if (allHome.every(p => p === 57)) {
        return player.color;
      }
    }
    return undefined;
  }

  async advanceTurn(gameId: string): Promise<void> {
    const state = await this.store.getGameState(gameId);
    if (!state || state.status !== 'active') return;

    let nextIndex = (state.currentTurnIndex + 1) % 4;
    let loopCount = 0;

    while (state.players[nextIndex].status !== 'active' && loopCount < 4) {
      nextIndex = (nextIndex + 1) % 4;
      loopCount++;
    }

    if (loopCount >= 4) {
      await this.store.setGameStatus(gameId, 'finished');
      return;
    }

    const nextColor = state.players[nextIndex].color;
    await this.store.setCurrentTurn(gameId, nextColor);
  }

  async handlePlayerExit(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.store.getGameState(gameId);
    if (!state) return;

    for (let i = 0; i < 4; i++) {
      await this.store.updatePieceProgress(gameId, color, i, -1);
    }
    await this.store.setPlayerStatus(gameId, color, 'exited');

    if (state.currentTurn === color && state.status === 'active') {
      await this.advanceTurn(gameId);
    }
  }
}
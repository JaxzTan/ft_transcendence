import { GameState, PlayerColor, LegalMove, PieceId } from './types';
import { BoardMapper } from './board-mapper';

/**
 * MoveValidator - determines legal moves for a given dice roll.
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
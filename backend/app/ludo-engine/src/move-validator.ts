import { GameState, PlayerColor, LegalMove, PieceId, MoveResult } from './types';
import { BoardMapper } from './board-mapper';

/**
 * MoveValidator - determines legal moves, resolves captures, checks wins, and executes moves.
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
      
      // Prison exit rule: can only leave prison on a roll of 6.
      // Exiting places the piece on the starting track square (step 1) — the 6
      // is consumed to exit; the remaining 5 steps are NOT applied. The next
      // roll then moves the piece 1-6 steps.
      if (from === 0) {
        if (diceValue !== 6) continue;
        const to = 1;
        const isHomeEntry = false;
        const isCapture = this.wouldCaptureStatic(state, color, piece.id, to);
        moves.push({ pieceId: piece.id, from, to, isCapture, isHomeEntry });
        continue;
      }
      
      const to = from + diceValue;
      if (to > 57) continue; // overshoot
      
      // Blockade rule: cannot pass THROUGH a two-or-more same-color opponent stack.
      // Any intermediate track step the piece would cross is blocked.
      if (this.blockadeBlocksPath(state, color, from, to, piece.id)) {
        continue;
      }
      
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

  /**
   * True if an opponent blockade (2+ same-color pieces on one non-safe track square)
   * lies on the path a piece would cross between `from` (exclusive) and `to` (inclusive).
   * Safe zones never form a blockade, and a blockade only blocks landing/passing on
   * the 52-loop — home stretch (52-56) and goal (57) are immune.
   */
  static blockadeBlocksPath(
    state: GameState,
    moverColor: PlayerColor,
    from: number,
    to: number,
    pieceId: PieceId,
  ): boolean {
    // Moves that never touch the main track can't be blocked.
    if (from < 1 || to < 1) return false;

    // Opponents' blockades only matter; own pieces never physically block the mover.
    const opponentColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'].filter(c => c !== moverColor) as PlayerColor[];

    // Walk the mover's own-step path, but only main-track steps (1-51) participate.
    // When the move ends in the home stretch/goal (to > 51), still check the
    // intermediate track cells (e.g. step 51) the piece crosses before entering home.
    const lastTrackStep = Math.min(to, 51);
    for (let step = from + 1; step <= lastTrackStep; step++) {
      const moverPos = BoardMapper.toTrackPosition(pieceId, step);
      if (moverPos === -1) continue;
      // Safe zones never form a blockade — skip them so a stack there doesn't block.
      if (BoardMapper.isSafeZoneStep(pieceId, step)) continue;
      for (const blockerColor of opponentColors) {
        if (BoardMapper.isBlockadeAtTrackPos(state.pieces, blockerColor, moverPos)) {
          return true;
        }
      }
    }
    return false;
  }

  static wouldCaptureStatic(state: GameState, excludeColor: PlayerColor, pieceId: PieceId, targetStep: number): boolean {
    if (targetStep <= 0 || targetStep >= 57) return false;
    
    // Check safe zones using BoardMapper (safe zones are track positions 8, 13, 21, 26, 34, 39, 47)
    if (BoardMapper.isSafeZoneStep(pieceId, targetStep)) return false;

    // Blockade rule: a 2+ same-color opponent stack on the landing square is
    // uncapturable — sharing is fine, capturing is not. The blocker pieces are
    // compared on the shared track loop via the mover's target track position.
    const targetPos = BoardMapper.toTrackPosition(pieceId, targetStep);
    if (targetPos !== -1) {
      const opponentColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'].filter(c => c !== excludeColor) as PlayerColor[];
      for (const blockerColor of opponentColors) {
        if (BoardMapper.isBlockadeAtTrackPos(state.pieces, blockerColor, targetPos)) {
          return false;
        }
      }
    }

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

  static resolveCapture(state: GameState, capturerColor: PlayerColor, targetStep: number): PieceId | undefined {
    return this.findPieceAtPosition(state, capturerColor, targetStep);
  }

  static checkWinner(state: GameState): PlayerColor | null {
    for (const player of state.players) {
      const playerPieces = state.pieces.filter(p => p.color === player.color);
      if (playerPieces.every(p => p.step === 57)) {
        return player.color;
      }
    }
    return null;
  }

  static countPiecesInGoal(state: GameState, color: PlayerColor): number {
    return state.pieces.filter(p => p.color === color && p.step === 57).length;
  }

  static executeMove(state: GameState, pendingMove: LegalMove, diceValue: number): MoveResult {
    const piece = state.pieces.find(p => p.id === pendingMove.pieceId)!;
    const capturerColor = piece.color;
    
    // Move piece
    piece.step = pendingMove.to;
    
    // Resolve capture
    let capturedPieceId: PieceId | undefined;
    if (pendingMove.isCapture) {
      capturedPieceId = this.resolveCapture(state, capturerColor, pendingMove.to);
      if (capturedPieceId) {
        const captured = state.pieces.find(p => p.id === capturedPieceId)!;
        captured.step = 0;
        const capturer = state.players.find(p => p.color === capturerColor)!;
        capturer.stats.captures++;
      }
    }
    
    // Update player turn count
    const player = state.players.find(p => p.color === capturerColor)!;
    player.stats.turns++;
    
    // Build result
    return {
      ply: state.moveCounter + 1,
      color: capturerColor,
      diceValue,
      pieceId: pendingMove.pieceId,
      from: pendingMove.from,
      to: pendingMove.to,
      captured: pendingMove.isCapture,
      capturedPieceId,
      enteredHome: pendingMove.isHomeEntry,
      bonusRoll: diceValue === 6 || pendingMove.isCapture
    };
  }
}
import type { PlayerColor, PieceId } from './types';

/**
 * BoardMapper handles all coordinate math and step-to-position translations.
 * The engine works with logical steps (0-57), not board coordinates.
 */
export class BoardMapper {
  // Safe zone track positions (shared by all players)
  private static readonly SAFE_TRACK_POSITIONS = [8, 13, 21, 26, 34, 39, 47];

  /**
   * Parse piece ID into color and index
   */
  static parsePieceId(pieceId: PieceId): { color: PlayerColor; index: number } {
    const [color, indexStr] = pieceId.split('-');
    return { color: color as PlayerColor, index: parseInt(indexStr, 10) };
  }

  /**
   * Check if a move destination (by step) lands on a safe zone.
   * Safe zones are at track positions: 8, 13, 21, 26, 34, 39, 47
   */
  static isSafeZoneStep(pieceId: PieceId, step: number): boolean {
    if (step < 1 || step > 51) return false;
    const boardPos = this.toTrackPosition(pieceId, step);
    return this.SAFE_TRACK_POSITIONS.includes(boardPos);
  }

  /**
   * Convert a piece step to its effective track position for collision detection.
   * Pieces on the track (not in home) are on a shared 52-position loop.
   */
  static toTrackPosition(pieceId: PieceId, step: number): number {
    const { color } = this.parsePieceId(pieceId);

    if (step < 1 || step > 51) {
      return -1; // Not on track
    }

    const offset = { red: 0, green: 13, yellow: 26, blue: 39 }[color];
    return ((step + offset - 1) % 52) + 1;
  }
}
import { GameState, PlayerColor } from './types';

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
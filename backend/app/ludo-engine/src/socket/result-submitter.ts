import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import type { PlayerColor } from '../types';
import { BACKEND_URL } from './auth';

/**
 * ResultSubmitter handles game end: submitting results to the backend
 * and cleaning up in-memory state.
 */
export class ResultSubmitter {
  constructor(
    private engine: LudoEngine,
    private store: RedisGameStore,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private cleanup: (gameId: string) => void,
  ) {}

  async submitGameResult(gameId: string): Promise<void> {
    try {
      const state = await this.engine.getGameState(gameId);
      if (!state) return;

      if (state.resultSubmitted) {
        console.log(`Game ${gameId} result already submitted, skipping`);
        return;
      }
      state.resultSubmitted = true;
      await this.store.saveGameState(gameId, state);

      const participants = [];
      for (const player of state.players) {
        const stats = { ...player.stats };
        const userId = this.userIdMap.get(gameId)?.get(player.color) || `bot-${player.color}`;
        participants.push({
          userId,
          color: player.color.toUpperCase(),
          rank: player.color === state.winner ? 1 : 2,
          totalTurns: stats.turns,
          piecesCaptured: stats.captures,
          piecesInGoal: stats.piecesInGoal,
        });
      }

      await fetch(`${BACKEND_URL}/api/game/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, participants }),
      });
    } catch (err) {
      console.error('Failed to submit game result:', err);
    }
  }
}
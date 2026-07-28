import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import type { PlayerColor } from '../types';
import { BACKEND_URL } from './auth';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Read the engine API key from the shared secrets directory.
 * Same convention as the backend's secrets.ts: <SECRETS_DIR>/<name>.txt
 */
function getEngineApiKey(): string {
  const dir = process.env.SECRETS_DIR || '/secrets';
  try {
    return readFileSync(join(dir, 'engine_api_key.txt'), 'utf8').trim();
  } catch {
    // Fallback for development without secrets mounted
    return process.env.ENGINE_API_KEY || 'dev-engine-key';
  }
}

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

      const engineApiKey = getEngineApiKey();
      await fetch(`${BACKEND_URL}/api/game/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Engine-Key': engineApiKey,
        },
        body: JSON.stringify({ gameId, participants }),
      });
    } catch (err) {
      console.error('Failed to submit game result:', err);
    }
  }
}
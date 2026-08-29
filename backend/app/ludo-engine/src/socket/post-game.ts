import { Server } from 'socket.io';
import { LudoEngine } from '../engine';
import { RedisGameStore } from '../redis';
import { EventPublisher } from './event-publisher';
import { GameSocket } from './auth';
import type { PlayerColor } from '../types';

/**
 * PostGameManager owns the end-of-game lifecycle: the post-game timeout
 * when no rematch materialises, rematch voting, exit_post_game, and the
 * "End Game" button. SocketServer injects the shared collaborators plus a
 * cleanup callback so this class can tear a game down entirely.
 */
export class PostGameManager {
  private rematchVotes: Map<string, Set<string>> = new Map();
  private gameEndedAt: Map<string, number> = new Map();

  constructor(
    private getIo: () => Server,
    private store: RedisGameStore,
    private engine: LudoEngine,
    private publisher: EventPublisher,
    private userIdMap: Map<string, Map<PlayerColor, string>>,
    private seatColors: PlayerColor[],
    private postGameTimeoutMs: number,
    private cleanup: (gameId: string) => void,
  ) {}

  /** A game finished: stamp when, and auto-timeout if no rematch arrives. */
  onGameEnded(gameId: string): void {
    this.gameEndedAt.set(gameId, Date.now());

    // Auto-timeout after postGameTimeoutMs if no rematch
    setTimeout(() => {
      const votes = this.rematchVotes.get(gameId);
      if (!votes || votes.size < 2) {
        this.getIo().to(gameId).emit('game_timeout');
        this.cleanup(gameId);
      }
    }, this.postGameTimeoutMs);
  }

  async handleRematch(socket: GameSocket): Promise<void> {
    const gameId = socket.data.gameId;
    const userId = socket.data.userId;
    if (!gameId || !userId) return;

    // Track vote
    if (!this.rematchVotes.has(gameId)) {
      this.rematchVotes.set(gameId, new Set());
    }
    this.rematchVotes.get(gameId)!.add(userId);

    // Check if at least 2 players voted for rematch
    if (this.rematchVotes.get(gameId)!.size >= 2) {
      // Create new game with only rematching players
      const newGameId = `${gameId}-rematch`;
      const oldMatchData = await this.store.getMatchData(gameId);
      const playerCount = parseInt(oldMatchData?.playerCount || '4', 10);
      // Reuse the original seat order (skipped colors in hotseat etc.)
      // rather than re-densifying the first playerCount colors.
      const seatColors = oldMatchData?.seatColors
        ? (oldMatchData.seatColors.split(',') as PlayerColor[])
        : this.seatColors.slice(0, playerCount);
      await this.store.createGame(newGameId, oldMatchData?.clashEnabled === 'true', seatColors, oldMatchData?.safeZones !== 'false');

      // Transfer players who voted
      const voters = this.rematchVotes.get(gameId)!;
      for (const [color, uid] of (this.userIdMap.get(gameId) || [])) {
        if (voters.has(uid)) {
          socket.join(newGameId);
          // Update userIdMap for new game
          if (!this.userIdMap.has(newGameId)) {
            this.userIdMap.set(newGameId, new Map());
          }
          this.userIdMap.get(newGameId)!.set(color, uid);
        }
      }

      this.cleanup(gameId);
      this.getIo().to(newGameId).emit('game_created', newGameId);
    }
  }

  handleExitPostGame(socket: GameSocket): void {
    const gameId = socket.data.gameId;
    const userId = socket.data.userId;
    if (!gameId || !userId) return;

    // Remove from rematch votes if present
    this.rematchVotes.get(gameId)?.delete(userId);

    // Check if quorum is broken (fewer than 2 voters remain)
    const votes = this.rematchVotes.get(gameId);
    if (!votes || votes.size < 2) {
      this.getIo().to(gameId).emit('game_timeout');
      this.cleanup(gameId);
    }
  }

  /**
   * Definitive game termination via the frontend's "End Game" button.
   *  - PvP: prune just this player (pieces cleaned, seat exited) and emit
   *    player_aborted for the log line; the game continues if >= 2 humans
   *    remain, otherwise the whole instance is aborted + cleaned up.
   *  - PvE/Hotseat: the whole instance is aborted and its engine state
   *    deleted -> "Resume last game" becomes unreachable. No result POSTed
   *    (aborted games have no definitive result).
   */
  async handleEndGame(socket: GameSocket): Promise<void> {
    const gameId = socket.data.gameId;
    const color = socket.data.playerColor;
    if (!gameId || !color) return;

    const state = await this.store.loadGameState(gameId);
    if (!state) return;
    const player = state.players.find((p: any) => p.color === color);
    const username = player?.username || color;
    const match = await this.store.getMatchData(gameId);
    const isBotMode = match?.gameType === 'PVE' || match?.gameType === 'HOTSEAT';

    if (isBotMode) {
      this.getIo().to(gameId).emit('game_expired');
      this.cleanup(gameId);
      await this.store.abortMatch(gameId);
      await this.store.deleteGame(gameId);
      return;
    }

    // PvP: prune only this player.
    await this.engine.handlePlayerExit(gameId, color);
    this.publisher.publish({ type: 'player_aborted', gameId, color, username });

    // If fewer than 2 humans remain, the game cannot continue -> abort+clean.
    const remaining = await this.store.loadGameState(gameId);
    if (!remaining || remaining.players.filter((p: any) => p.status === 'active' && !p.isBot).length < 2) {
      this.getIo().to(gameId).emit('game_expired');
      this.cleanup(gameId);
      await this.store.abortMatch(gameId);
      await this.store.deleteGame(gameId);
    }
  }

  /** Drop this game's post-game state (votes + end timestamp). */
  clear(gameId: string): void {
    this.rematchVotes.delete(gameId);
    this.gameEndedAt.delete(gameId);
  }
}
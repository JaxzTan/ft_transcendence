import Redis from 'ioredis';
import type { GameState, PlayerColor, PieceId, Piece, PlayerMeta, ClashState } from './types';

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

/**
 * RedisGameStore is a PERSISTENCE LAYER.
 * All game state is stored as a single serialized GameState object.
 * Game logic operates on in-memory GameState first, then persists.
 */
export class RedisGameStore {
  private client: Redis;
  private subscriber: Redis;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || 'redis://redis:6379');
    this.subscriber = this.client.duplicate();
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.subscriber.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
  }

  /** Create a new game with all 16 pieces in prison */
  async createGame(gameId: string, clashMode: boolean): Promise<void> {
    const pieces: Piece[] = [];
    for (const color of COLORS) {
      for (let i = 0; i < 4; i++) {
        pieces.push({ id: `${color}-${i}`, color, step: 0 });
      }
    }
    
    const players: PlayerMeta[] = COLORS.map(color => ({
      color,
      status: 'inactive',
      stats: { turns: 0, captures: 0, piecesInGoal: 0 }
    }));
    
    const state: GameState = {
      id: gameId,
      pieces,
      players,
      currentTurn: 'red',
      consecutiveSixes: 0,
      moveCounter: 0,
      turnPhase: 'WAITING_FOR_ROLL',
      pendingLegalMoves: [],
      disconnectedPlayers: [],
      status: 'waiting',
      clash: clashMode ? undefined : undefined
    };
    
    await this.saveGameState(gameId, state);
  }

  /** Load the entire GameState from Redis (single operation) */
  async loadGameState(gameId: string): Promise<GameState | null> {
    const data = await this.client.hget(this.gameKey(gameId), 'state');
    if (!data) return null;
    return JSON.parse(data) as GameState;
  }

  /** Save the entire GameState to Redis (single operation) */
  async saveGameState(gameId: string, state: GameState): Promise<void> {
    await this.client.hset(this.gameKey(gameId), 'state', JSON.stringify(state));
    await this.client.expire(this.gameKey(gameId), 86400);
  }

  /** Add a player to the game (marks them as active) */
  async addPlayer(gameId: string, color: PlayerColor): Promise<void> {
    const state = await this.loadGameState(gameId);
    if (!state) return;
    
    const player = state.players.find(p => p.color === color);
    if (player) {
      player.status = 'active';
      await this.saveGameState(gameId, state);
    }
  }

  /** Get player stats */
  async getPlayerStats(gameId: string, color: PlayerColor): Promise<{ turns: number; captures: number; piecesInGoal: number }> {
    const state = await this.loadGameState(gameId);
    const player = state?.players.find(p => p.color === color);
    if (!player) return { turns: 0, captures: 0, piecesInGoal: 0 };
    return { ...player.stats };
  }

  /** Move history (separate, not part of main state) */
  async recordMove(gameId: string, move: { ply: number; color: PlayerColor; diceValue: number; pieceId: PieceId; from: number; to: number; captured: boolean; enteredHome: boolean; timestamp: number }): Promise<void> {
    await this.client.lpush(this.movesKey(gameId), JSON.stringify(move));
    await this.client.ltrim(this.movesKey(gameId), 0, 199);
  }

  /** Clash state management */
  async loadClashState(gameId: string): Promise<ClashState | null> {
    const state = await this.loadGameState(gameId);
    return state?.clash ?? null;
  }

  async saveClashState(gameId: string, clash: ClashState): Promise<void> {
    const state = await this.loadGameState(gameId);
    if (!state) return;
    
    state.clash = clash;
    await this.saveGameState(gameId, state);
  }

  async clearClashState(gameId: string): Promise<void> {
    const state = await this.loadGameState(gameId);
    if (!state) return;
    
    delete state.clash;
    await this.saveGameState(gameId, state);
  }

  async recordClashPress(gameId: string, color: PlayerColor): Promise<number> {
    const state = await this.loadGameState(gameId);
    if (!state?.clash) return 0;
    
    const isAttacker = state.clash.attacker === color;
    if (isAttacker) {
      state.clash.attackerPresses++;
    } else {
      state.clash.defenderPresses++;
    }
    await this.saveGameState(gameId, state);
    return isAttacker ? state.clash.attackerPresses : state.clash.defenderPresses;
  }

  /** Publish state change to all subscribers */
  async publish(gameId: string, message: string): Promise<void> {
    await this.client.publish(`game:${gameId}`, message);
  }

  /** Delete entire game */
  async deleteGame(gameId: string): Promise<void> {
    const keys = [
      this.gameKey(gameId),
      this.movesKey(gameId),
      this.clashKey(gameId)
    ];
    await this.client.del(keys);
  }

  private gameKey(gameId: string): string { return `game:${gameId}`; }
  private movesKey(gameId: string): string { return `game:${gameId}:moves`; }
  private clashKey(gameId: string): string { return `game:${gameId}:clash`; }
}
import Redis from 'ioredis';
import { GameState, PlayerColor, PlayerStatus } from './types';

export class RedisGameStore {
  private client: any;
  private subscriber: any;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
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

  async createGame(gameId: string, clashMode: boolean): Promise<void> {
    const key = this.gameKey(gameId);
    await this.client.hset(key, {
      currentTurn: 'red',
      consecutiveSixes: '0',
      clashMode: clashMode ? '1' : '0',
      status: 'waiting',
      startedAt: Date.now().toString()
    });
    await this.client.expire(key, 86400);
  }

  async addPlayer(gameId: string, color: PlayerColor): Promise<void> {
    const pKey = this.playerKey(gameId, color);
    await this.client.hset(pKey, {
      status: 'active',
      piece0: '0',
      piece1: '0',
      piece2: '0',
      piece3: '0',
      turns: '0',
      captures: '0',
      piecesInGoal: '0'
    });
    await this.client.sadd(this.playersKey(gameId), color);
  }

  async incrementPlayerTurn(gameId: string, color: PlayerColor): Promise<void> {
    await this.client.hincrby(this.playerKey(gameId, color), 'turns', 1);
  }

  async incrementPlayerCapture(gameId: string, color: PlayerColor): Promise<void> {
    await this.client.hincrby(this.playerKey(gameId, color), 'captures', 1);
  }

  async setPlayerPiecesInGoal(gameId: string, color: PlayerColor, count: number): Promise<void> {
    await this.client.hset(this.playerKey(gameId, color), 'piecesInGoal', count.toString());
  }

  async getPlayerStats(gameId: string, color: PlayerColor): Promise<{ turns: number; captures: number; piecesInGoal: number }> {
    const pData = await this.client.hgetall(this.playerKey(gameId, color));
    return {
      turns: parseInt(pData?.turns) || 0,
      captures: parseInt(pData?.captures) || 0,
      piecesInGoal: parseInt(pData?.piecesInGoal) || 0,
    };
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    const key = this.gameKey(gameId);
    const data = await this.client.hgetall(key);
    if (!data || !data.currentTurn) return null;

    const players: GameState['players'] = [];
    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    
    for (const color of colors) {
      const pData = await this.client.hgetall(this.playerKey(gameId, color));
      if (pData && pData.status) {
        players.push({
          color,
          status: pData.status as PlayerStatus,
          pieces: [
            { progress: parseInt(pData.piece0) || 0 },
            { progress: parseInt(pData.piece1) || 0 },
            { progress: parseInt(pData.piece2) || 0 },
            { progress: parseInt(pData.piece3) || 0 }
          ]
        });
      }
    }

    return {
      id: gameId,
      players,
      currentTurn: data.currentTurn as PlayerColor,
      currentTurnIndex: colors.indexOf(data.currentTurn as PlayerColor),
      consecutiveSixes: parseInt(data.consecutiveSixes) || 0,
      clashMode: data.clashMode === '1',
      status: data.status as GameState['status'],
      winner: data.winner as PlayerColor | undefined,
      resultDetail: data.resultDetail || undefined
    };
  }

  async updatePieceProgress(gameId: string, color: PlayerColor, pieceIndex: number, progress: number): Promise<void> {
    await this.client.hset(this.playerKey(gameId, color), `piece${pieceIndex}`, progress.toString());
  }

  async getPieceProgress(gameId: string, color: PlayerColor, pieceIndex: number): Promise<number> {
    const val = await this.client.hget(this.playerKey(gameId, color), `piece${pieceIndex}`);
    return val ? parseInt(val) : 0;
  }

  async setPlayerStatus(gameId: string, color: PlayerColor, status: PlayerStatus): Promise<void> {
    await this.client.hset(this.playerKey(gameId, color), 'status', status);
  }

  async getPlayerStatus(gameId: string, color: PlayerColor): Promise<PlayerStatus> {
    const val = await this.client.hget(this.playerKey(gameId, color), 'status');
    return (val as PlayerStatus) || 'active';
  }

  async setCurrentTurn(gameId: string, color: PlayerColor): Promise<void> {
    await this.client.hset(this.gameKey(gameId), 'currentTurn', color);
  }

  async incrementConsecutiveSixes(gameId: string): Promise<number> {
    return await this.client.hincrby(this.gameKey(gameId), 'consecutiveSixes', 1);
  }

  async resetConsecutiveSixes(gameId: string): Promise<void> {
    await this.client.hset(this.gameKey(gameId), 'consecutiveSixes', '0');
  }

  async setGameStatus(gameId: string, status: GameState['status'], winner?: PlayerColor, resultDetail?: string): Promise<void> {
    const data: Record<string, string> = { status };
    if (winner) data.winner = winner;
    if (resultDetail) data.resultDetail = resultDetail;
    await this.client.hset(this.gameKey(gameId), data);
  }

  async recordMove(gameId: string, move: { ply: number; color: PlayerColor; diceValue: number; pieceIndex: number; from: number; to: number; captured: boolean; enteredHome: boolean; timestamp: number }): Promise<void> {
    await this.client.lpush(this.movesKey(gameId), JSON.stringify(move));
    await this.client.ltrim(this.movesKey(gameId), 0, 199);
  }

  async getMoves(gameId: string): Promise<any[]> {
    const moves = await this.client.lrange(this.movesKey(gameId), 0, -1);
    return moves.map(m => JSON.parse(m));
  }

  async initClash(gameId: string, clash: { attacker: PlayerColor; defender: PlayerColor; attackerKey: string; defenderKey: string; target: number; duration: number; startedAt: number }): Promise<void> {
    await this.client.hset(this.clashKey(gameId), {
      ...clash,
      attackerPresses: '0',
      defenderPresses: '0'
    });
    await this.client.expire(this.clashKey(gameId), clash.duration + 10);
  }

  async recordClashPress(gameId: string, color: PlayerColor): Promise<number> {
    const clashData = await this.client.hgetall(this.clashKey(gameId));
    if (!clashData || !clashData.attacker) return 0;
    const isAttacker = clashData.attacker === color;
    const field = isAttacker ? 'attackerPresses' : 'defenderPresses';
    return await this.client.hincrby(this.clashKey(gameId), field, 1);
  }

  async getClashResult(gameId: string): Promise<{ attackerPresses: number; defenderPresses: number } | null> {
    const data = await this.client.hgetall(this.clashKey(gameId));
    if (!data || !data.attacker) return null;
    return {
      attackerPresses: parseInt(data.attackerPresses) || 0,
      defenderPresses: parseInt(data.defenderPresses) || 0
    };
  }

  async deleteGame(gameId: string): Promise<void> {
    const keys = [
      this.gameKey(gameId),
      this.movesKey(gameId),
      this.playersKey(gameId),
      this.clashKey(gameId)
    ];
    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    for (const color of colors) {
      keys.push(this.playerKey(gameId, color));
    }
    await this.client.del(keys);
  }

  async publish(gameId: string, message: string): Promise<void> {
    await this.client.publish(`game:${gameId}`, message);
  }

  async subscribe(gameId: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(`game:${gameId}`);
    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === `game:${gameId}`) {
        callback(message);
      }
    });
  }

  async pSubscribe(pattern: string, callback: (channel: string, message: string) => void): Promise<void> {
    await this.subscriber.pSubscribe(pattern, callback);
  }

  private gameKey(gameId: string): string { return `game:${gameId}`; }
  private playerKey(gameId: string, color: PlayerColor): string { return `game:${gameId}:player:${color}`; }
  private movesKey(gameId: string): string { return `game:${gameId}:moves`; }
  private playersKey(gameId: string): string { return `game:${gameId}:players`; }
  private clashKey(gameId: string): string { return `game:${gameId}:clash`; }
}
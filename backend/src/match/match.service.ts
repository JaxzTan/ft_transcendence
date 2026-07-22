import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { secret } from '../secrets';
import Redis from 'ioredis';

const BOT_ID = 'ludo-bot';

// Points-based rating (no ELO matchmaking). Winner +10, loser -5.
const WIN_POINTS = 10;
const LOSS_POINTS = 5;

function generateInviteCode(): string {
  // 6-char uppercase alphanumeric code (no I, O, 0, 1 to avoid confusion)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class MatchService {
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = secret('REDIS_PASSWORD');

    this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
    this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
  }

  // ─── Unified Match Creation ───────────────────────────────────────────────
  /**
   * Create a match in one of three modes:
   * - 'pvp': Human vs human (2-4 players), status = WAITING, needs ready check
   * - 'pve': Human vs bots (1 human + 1-3 bots), status = ACTIVE immediately
   * - 'hotseat': Hot seat local multiplayer (2-4 humans), status = ACTIVE immediately
   */
  async createMatch(
    userId: string,
    mode: 'pvp' | 'pve' | 'hotseat',
    playerCount: number,
    botCount: number,
    clashEnabled: boolean = true,
    color?: string,
  ) {
    if (playerCount < 2 || playerCount > 4) {
      throw new BadRequestException('Player count must be between 2 and 4');
    }
    if (botCount < 0 || botCount >= playerCount) {
      throw new BadRequestException('Bot count must be between 0 and playerCount - 1');
    }
    if (mode === 'pvp' && botCount > 0) {
      throw new BadRequestException('PvP mode cannot have bots');
    }
    if (mode === 'pve' && botCount === 0) {
      throw new BadRequestException('PvE mode must have at least 1 bot');
    }
    if (mode === 'hotseat' && botCount > 0) {
      throw new BadRequestException('Hot seat mode cannot have bots');
    }

    const gameId = crypto.randomUUID();
    const totalBots = botCount;
    const isPvP = mode === 'pvp';

    const updates: Record<string, string> = {
      id: gameId,
      status: isPvP ? 'WAITING' : 'ACTIVE',
      gameType: mode.toUpperCase(),
      player1_id: userId,
      player1_color: color || '',
      clashEnabled: clashEnabled.toString(),
      createdAt: Date.now().toString(),
    };

    if (isPvP) {
      // PvP: invite code for sharing
      updates.inviteCode = generateInviteCode();
    } else {
      // PvE or hotseat: started immediately, fill bot slots
      updates.startedAt = Date.now().toString();
      if (totalBots >= 1) updates.player2_id = BOT_ID;
      if (totalBots >= 2) updates.player3_id = BOT_ID;
      if (totalBots >= 3) updates.player4_id = BOT_ID;
    }

    await this.redis.hset(`match:${gameId}`, updates);
    await this.redis.expire(`match:${gameId}`, 86400);

    const token = this.jwt.sign(
      {
        gameId,
        playerId: userId,
        role: 'player1',
        mode,
        clashEnabled,
        color: color || undefined,
      },
      { expiresIn: '24h' },
    );

    const result: any = { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
    if (isPvP) {
      result.inviteCode = updates.inviteCode;
    }
    return result;
  }

  // ─── Legacy Endpoints (kept for backward compatibility) ───────────────────
  async findRandomMatch(userId: string, clashEnabled: boolean = true, color?: string) {
    // Scan Redis for a WAITING PvP game with an open slot
    const keys = await this.redis.keys('match:*');
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (
        data.status === 'WAITING' &&
        data.gameType === 'PVP' &&
        data.player1_id !== userId &&
        !data.player2_id
      ) {
        return this.joinMatch(data.id, userId, color);
      }
    }
    return this.createMatch(userId, 'pvp', 4, 0, clashEnabled, color);
  }


  async createInvite(userId: string, clashEnabled: boolean = true, color?: string) {
    const result = await this.createMatch(userId, 'pvp', 4, 0, clashEnabled, color);
    // createMatch returns inviteCode for PvP
    return result;
  }

  async playBot(userId: string, playerCount: number = 2, clashEnabled: boolean = true, color?: string) {
    if (playerCount !== 2 && playerCount !== 4) {
      throw new BadRequestException('Player count must be 2 or 4');
    }
    const botCount = playerCount - 1;
    return this.createMatch(userId, 'pve', playerCount, botCount, clashEnabled, color);
  }

  // ─── PvP: Join by invite code ────────────────────────────────────────────
  async joinByInvite(inviteCode: string, userId: string, color?: string) {
    const keys = await this.redis.keys('match:*');
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data.inviteCode === inviteCode && data.status === 'WAITING') {
        if (data.player1_id === userId) {
          throw new BadRequestException('You cannot join your own invite');
        }
        return this.joinMatch(data.id, userId, color);
      }
    }
    throw new NotFoundException('Invite code not found or expired');
  }

  // ─── Internal: join an existing match by filling next slot ───────────────
  async joinMatch(gameId: string, userId: string, color?: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');
    if (data.status !== 'WAITING') throw new ForbiddenException('Game already started');

    const clashEnabled = data.clashEnabled === 'true';
    const slotKey = !data.player2_id ? 'player2' : !data.player3_id ? 'player3' : 'player4';

    await this.redis.hset(`match:${gameId}`, `${slotKey}_id`, userId, `${slotKey}_color`, color || '', 'status', 'ACTIVE', 'startedAt', Date.now().toString());

    const token = this.jwt.sign(
      { gameId, playerId: userId, role: 'player', clashEnabled, color: color || undefined },
      { expiresIn: '24h' },
    );

    return { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── Cancel / Abort ──────────────────────────────────────────────────────
  async cancelGame(gameId: string, userId: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');

    const isPlayer = data.player1_id === userId || data.player2_id === userId ||
      data.player3_id === userId || data.player4_id === userId;
    if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

    await this.redis.hset(`match:${gameId}`, 'status', 'ABORTED');
    await this.redis.expire(`match:${gameId}`, 3600);

    return { message: 'Game cancelled', gameId };
  }

  async resign(gameId: string, userId: string) {
    return this.cancelGame(gameId, userId);
  }

  // ─── Process Game End (writes to Postgres) ─────────────────────────────
  async processGameEnd(data: any) {
    const { gameId, participants } = data;
    if (!gameId) throw new BadRequestException('gameId is required');
    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      throw new BadRequestException('participants array is required (min 2)');
    }

    const existing = await this.prisma.db.game.findUnique({ where: { id: gameId } });
    if (existing) return { message: 'Game already processed', gameId };

    const matchData = await this.redis.hgetall(`match:${gameId}`);
    const startedAt = matchData?.startedAt ? parseInt(matchData.startedAt) : null;
    const endedAt = Date.now();
    const durationSeconds = startedAt ? Math.floor((endedAt - startedAt) / 1000) : 0;
    const gameType = (matchData?.gameType as any) || 'PVP';
    const inviteCode = matchData?.inviteCode || null;

    await this.prisma.db.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          id: gameId,
          startedAt: new Date(startedAt || endedAt),
          endedAt: new Date(endedAt),
          status: 'COMPLETED',
          gameType,
          inviteCode,
        },
      });

      for (const p of participants) {
        await tx.gameParticipant.create({
          data: {
            id: crypto.randomUUID(),
            game_id: game.id,
            user_id: p.userId,
            color: p.color,
            rank: p.rank,
            piecesCaptured: p.piecesCaptured || 0,
            piecesInGoal: p.piecesInGoal || 0,
          },
        });

        // Points-based rating (no ELO). Bots are skipped.
        if (p.userId === BOT_ID) continue;
        const isWinner = p.rank === 1;
        const ratingDelta = isWinner ? WIN_POINTS : -LOSS_POINTS;
        const user = await tx.user.findUnique({ where: { id: p.userId } });
        if (user) {
          const newRating = Math.max(0, user.rating + ratingDelta);
          await tx.user.update({
            where: { id: p.userId },
            data: {
              rating: newRating,
              highestRating: Math.max(user.highestRating, newRating),
              humanWins: isWinner ? { increment: 1 } : undefined,
              botWins: gameType === 'PVE' && isWinner ? { increment: 1 } : undefined,
              winStreak: isWinner ? { increment: 1 } : 0,
              bestWinStreak: isWinner ? Math.max(user.winStreak + 1, user.bestWinStreak) : undefined,
            },
          });
          try {
            await this.redis.zadd('leaderboard:global', newRating, p.userId);
          } catch { /* ignore */ }
        }
      }
    });

    await this.redis.del(`match:${gameId}`);
    return { message: 'Game processed', gameId };
  }

  // ─── Rematch (Redis-based) ──────────────────────────────────────────────
  async rematch(gameId: string, userId: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');

    const isPlayer = data.player1_id === userId || data.player2_id === userId ||
      data.player3_id === userId || data.player4_id === userId;
    if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

    const pendingKey = `rematch:${gameId}`;
    const pending = new Set<string>(JSON.parse(await this.redis.get(pendingKey) || '[]'));
    pending.add(userId);
    await this.redis.set(pendingKey, JSON.stringify(Array.from(pending)), 'EX', 86400);

    const originalPlayers = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean);
    const confirmedCount = originalPlayers.filter(p => pending.has(p)).length;

    if (confirmedCount < 2) {
      return { message: 'Waiting for more players', confirmed: confirmedCount, required: 2 };
    }

    const newGameId = crypto.randomUUID();
    await this.redis.hset(`match:${newGameId}`, {
      id: newGameId,
      status: 'WAITING',
      gameType: data.gameType || 'PVP',
      inviteCode: data.inviteCode || '',
      player1_id: data.player1_id,
      player2_id: data.player2_id || '',
      player3_id: data.player3_id || '',
      player4_id: data.player4_id || '',
      createdAt: Date.now().toString(),
    });
    await this.redis.expire(`match:${newGameId}`, 86400);
    await this.redis.del(pendingKey);

    const token = this.jwt.sign(
      { gameId: newGameId, playerId: userId, role: 'player1' },
      { expiresIn: '24h' },
    );

    return { gameId: newGameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── List Active Games (from Redis) ─────────────────────────────────────
  async listActiveGames() {
    const keys = await this.redis.keys('match:*');
    const games: any[] = [];
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data.status === 'ACTIVE') {
        games.push({
          id: data.id,
          gameType: data.gameType,
          player1: data.player1_id,
          player2: data.player2_id,
        });
      }
    }
    return games;
  }

  // ─── Spectate ───────────────────────────────────────────────────────────
  async spectate(gameId: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');
    if (data.status !== 'ACTIVE') throw new ForbiddenException('Game is not active');

    const token = this.jwt.sign(
      { gameId, playerId: null, role: 'spectator' },
      { expiresIn: '24h' },
    );

    return { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── Ready Game ─────────────────────────────────────────────────────────
  async readyGame(gameId: string, userId: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');

    const isPlayer = data.player1_id === userId || data.player2_id === userId ||
      data.player3_id === userId || data.player4_id === userId;
    if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

    return { message: 'Player ready', gameId };
  }

  // ─── Exit Game ──────────────────────────────────────────────────────────
  async exitGame(gameId: string, userId: string) {
    return { message: 'Exited game', gameId };
  }

  async gameEnd(gameId: string, userId: string) {
    return { message: 'Game end acknowledged', gameId };
  }

  // ─── Cleanup Stale Games (Redis) ─────────────────────────────────────────
  async cleanupOldMoves() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const keys = await this.redis.keys('match:*');
    let cleaned = 0;

    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      const createdAt = parseInt(data.createdAt || '0');
      if (createdAt > 0 && createdAt < oneDayAgo) {
        await this.redis.del(key);
        cleaned++;
      }
    }

    const rematchKeys = await this.redis.keys('rematch:*');
    for (const key of rematchKeys) {
      await this.redis.del(key);
    }

    return { matchesCleaned: cleaned, rematchKeysCleaned: rematchKeys.length };
  }
}
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const BOT_ID = 'ludo-bot';

// Points-based rating (no ELO matchmaking). Winner +10, loser -5.
const WIN_POINTS = 10;
const LOSS_POINTS = 5;

function generateInviteCode(): string {
  // 6-char uppercase alphanumeric code
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
    this.redis = new Redis(REDIS_URL);
  }

  // ─── PvP: Random auto-matchmaking ─────────────────────────────────────────
  async findRandomMatch(userId: string) {
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
        return this.joinMatch(data.id, userId);
      }
    }
    return this.createMatch(userId, 'PVP');
  }

  // ─── PvP: Create invite game (share code via chat) ───────────────────────
  async createInvite(userId: string) {
    const gameId = crypto.randomUUID();
    const inviteCode = generateInviteCode();

    await this.redis.hset(`match:${gameId}`, {
      id: gameId,
      status: 'WAITING',
      gameType: 'PVP',
      inviteCode,
      player1_id: userId,
      createdAt: Date.now().toString(),
    });
    await this.redis.expire(`match:${gameId}`, 86400);

    const token = this.jwt.sign(
      { gameId, playerId: userId, role: 'player1' },
      { expiresIn: '24h' },
    );

    return { gameId, inviteCode, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── PvP: Join by invite code ────────────────────────────────────────────
  async joinByInvite(inviteCode: string, userId: string) {
    const keys = await this.redis.keys('match:*');
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data.inviteCode === inviteCode && data.status === 'WAITING') {
        if (data.player1_id === userId) {
          throw new BadRequestException('You cannot join your own invite');
        }
        return this.joinMatch(data.id, userId);
      }
    }
    throw new NotFoundException('Invite code not found or expired');
  }

  // ─── PvE: Human vs Bot (2p or 4p) ────────────────────────────────────────
  async playBot(userId: string, playerCount: number = 2) {
    if (playerCount !== 2 && playerCount !== 4) {
      throw new BadRequestException('Player count must be 2 or 4');
    }

    const gameId = crypto.randomUUID();
    const totalBots = playerCount - 1;

    const updates: Record<string, string> = {
      id: gameId,
      status: 'ACTIVE',
      gameType: 'PVE',
      player1_id: userId,
      startedAt: Date.now().toString(),
    };
    if (totalBots >= 1) updates.player2_id = BOT_ID;
    if (totalBots >= 2) updates.player3_id = BOT_ID;
    if (totalBots >= 3) updates.player4_id = BOT_ID;

    await this.redis.hset(`match:${gameId}`, updates);
    await this.redis.expire(`match:${gameId}`, 86400);

    const token = this.jwt.sign(
      { gameId, playerId: userId, role: 'player1' },
      { expiresIn: '24h' },
    );

    return { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── Internal: create a WAITING match ────────────────────────────────────
  private async createMatch(userId: string, gameType: 'PVP' | 'PVE') {
    const gameId = crypto.randomUUID();
    await this.redis.hset(`match:${gameId}`, {
      id: gameId,
      status: 'WAITING',
      gameType,
      player1_id: userId,
      createdAt: Date.now().toString(),
    });
    await this.redis.expire(`match:${gameId}`, 86400);

    const token = this.jwt.sign(
      { gameId, playerId: userId, role: 'player1' },
      { expiresIn: '24h' },
    );

    return { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── Internal: join an existing match by filling next slot ───────────────
  async joinMatch(gameId: string, userId: string) {
    const data = await this.redis.hgetall(`match:${gameId}`);
    if (!data || !data.id) throw new NotFoundException('Game not found');
    if (data.status !== 'WAITING') throw new ForbiddenException('Game already started');

    if (!data.player2_id) {
      await this.redis.hset(`match:${gameId}`, 'player2_id', userId, 'status', 'ACTIVE', 'startedAt', Date.now().toString());
    } else if (!data.player3_id) {
      await this.redis.hset(`match:${gameId}`, 'player3_id', userId, 'status', 'ACTIVE', 'startedAt', Date.now().toString());
    } else if (!data.player4_id) {
      await this.redis.hset(`match:${gameId}`, 'player4_id', userId, 'status', 'ACTIVE', 'startedAt', Date.now().toString());
    } else {
      throw new ForbiddenException('Game is full');
    }

    const token = this.jwt.sign(
      { gameId, playerId: userId, role: 'player' },
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
          durationSeconds,
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
            totalTurns: p.totalTurns || 0,
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
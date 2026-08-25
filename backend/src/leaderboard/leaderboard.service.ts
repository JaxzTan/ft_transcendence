import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeaderboardRedisService } from './leaderboard-redis.service';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avatarStyle: string | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  myRank?: { rank: number; username: string; displayName: string; rating: number } | null;
  source?: 'redis' | 'postgres';
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: LeaderboardRedisService,
  ) {}

  async getLeaderboard(options: {
    mode?: 'global' | 'ranked' | 'casual' | 'bot';
    page: number;
    limit: number;
    userId?: string;
  }): Promise<LeaderboardResponse> {
    const { mode, page, limit, userId } = options;

    // Try Redis first (fast path)
    try {
      let redisEntries = await this.redisService.getLeaderboardFromRedis(mode, page, limit);
      let total = await this.redisService.getLeaderboardCount(mode);

      // If Redis has no entries or is missing users, auto-populate from PostgreSQL
      if (redisEntries.length === 0 || total < 5) {
        const allDbUsers = await this.prisma.db.user.findMany({ select: { id: true, rating: true } });
        if (allDbUsers.length > 0) {
          for (const u of allDbUsers) {
            await this.redisService.updateLeaderboardEntry(u.id, u.rating, (mode as any) || 'global');
          }
          redisEntries = await this.redisService.getLeaderboardFromRedis(mode, page, limit);
          total = await this.redisService.getLeaderboardCount(mode);
        }
      }

      if (redisEntries.length > 0) {
        const userIds = redisEntries.map(e => e.userId);
        const users = await this.prisma.db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            displayName: true,
            rating: true,
            wins: true,
            losses: true,
            avatarStyle: true,
          },
        });

        const userMap = new Map(users.map(u => [u.id, u]));
        const entries: LeaderboardEntry[] = redisEntries
          .filter(e => userMap.has(e.userId))
          .map((entry, i) => {
            const user = userMap.get(entry.userId)!;
            const gamesPlayed = user.wins + user.losses;
            const wins = user.wins;
            const losses = user.losses;
            const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

            return {
              rank: (page - 1) * limit + i + 1,
              username: user.username,
              displayName: user.displayName,
              rating: entry.rating,
              gamesPlayed,
              wins,
              losses,
              draws: 0,
              winRate,
              avatarStyle: user.avatarStyle,
            };
          });

        const response: LeaderboardResponse = {
          entries,
          total,
          page,
          limit,
          source: 'redis',
        };

        if (userId) {
          const myRank = await this.redisService.getUserRank(userId, mode);
          if (myRank) {
            const user = await this.prisma.db.user.findUnique({
              where: { id: userId },
              select: { username: true, displayName: true, rating: true },
            });
            if (user) {
              response.myRank = {
                rank: myRank,
                username: user.username,
                displayName: user.displayName,
                rating: user.rating,
              };
            }
          }
        }

        return response;
      }
    } catch (err) {
      console.warn('Redis leaderboard read failed, falling back to PostgreSQL snapshot:', err);
    }

    // Fallback to PostgreSQL snapshot (mirror of Redis, written on every game end)
    const modeFilter = mode || 'global';
    const snapshotEntries = await this.prisma.db.leaderboardSnapshot.findMany({
      where: { mode: modeFilter },
      select: {
        rank: true,
        username: true,
        rating: true,
        userId: true,
      },
      orderBy: { rank: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.db.leaderboardSnapshot.count({
      where: { mode: modeFilter },
    });

    const userUsernames = snapshotEntries.map(e => e.username);
    const users = await this.prisma.db.user.findMany({
      where: { username: { in: userUsernames } },
      select: {
        username: true,
        displayName: true,
        wins: true, losses: true, avatarStyle: true,
      },
    });
    const userMap = new Map(users.map(u => [u.username, u]));

    const entries: LeaderboardEntry[] = snapshotEntries.map(entry => {
      const u = userMap.get(entry.username);
      const wins = u?.wins ?? 0;
      const losses = u?.losses ?? 0;
      const gamesPlayed = wins + losses;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

      return {
        rank: entry.rank,
        username: entry.username,
        displayName: u?.displayName ?? entry.username,
        rating: entry.rating,
        gamesPlayed,
        wins,
        losses,
        draws: 0,
        winRate,
        avatarStyle: u?.avatarStyle ?? null,
      };
    });

    const response: LeaderboardResponse = {
      entries,
      total,
      page,
      limit,
      source: 'postgres',
    };

    if (userId) {
      const mySnapshot = await this.prisma.db.leaderboardSnapshot.findUnique({
        where: { mode_userId: { mode: modeFilter, userId } },
      });
      if (mySnapshot) {
        const myUser = await this.prisma.db.user.findUnique({
          where: { id: userId },
          select: { displayName: true },
        });
        response.myRank = {
          rank: mySnapshot.rank,
          username: mySnapshot.username,
          displayName: myUser?.displayName ?? mySnapshot.username,
          rating: mySnapshot.rating,
        };
      }
    }

    return response;
  }
}
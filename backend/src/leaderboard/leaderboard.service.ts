import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeaderboardRedisService } from './leaderboard-redis.service';

export interface LeaderboardEntry {
  rank: number;
  username: string;
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
  myRank?: { rank: number; username: string; rating: number } | null;
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
      const redisEntries = await this.redisService.getLeaderboardFromRedis(mode, page, limit);
      const total = await this.redisService.getLeaderboardCount(mode);

      if (redisEntries.length > 0) {
        const userIds = redisEntries.map(e => e.userId);
        const users = await this.prisma.db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
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
              select: { username: true, rating: true },
            });
            if (user) {
              response.myRank = {
                rank: myRank,
                username: user.username,
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
      orderBy: { rank: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.db.leaderboardSnapshot.count({
      where: { mode: modeFilter },
    });

    const entries: LeaderboardEntry[] = snapshotEntries.map(entry => ({
      rank: entry.rank,
      username: entry.username,
      rating: entry.rating,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      avatarStyle: null,
    }));

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
        response.myRank = {
          rank: mySnapshot.rank,
          username: mySnapshot.username,
          rating: mySnapshot.rating,
        };
      }
    }

    return response;
  }
}
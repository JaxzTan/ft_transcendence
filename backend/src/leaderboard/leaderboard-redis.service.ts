import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { secret } from '../secrets';

@Injectable()
export class LeaderboardRedisService implements OnModuleDestroy {
  private redis: Redis;

  constructor() {
    // Host/port stay plain env — they're topology, not secrets.
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = secret('REDIS_PASSWORD');

    this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
    this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
  }

  onModuleDestroy() {
    this.redis.quit();
  }

  /**
   * Update leaderboard entry for a user
   * @param userId - User ID
   * @param rating - User's current rating
   * @param mode - Game mode (global, ranked, casual, bot)
   */
  async updateLeaderboardEntry(userId: string, rating: number, mode: 'global' | 'ranked' | 'casual' | 'bot'): Promise<void> {
    const key = `leaderboard:${mode}`;
    await this.redis.zadd(key, rating, userId);
  }

  /**
   * Get leaderboard from Redis with pagination
   * @param mode - Game mode
   * @param page - Page number (1-based)
   * @param limit - Results per page
   * @returns Array of {userId, rating} sorted by rating descending
   */
  async getLeaderboardFromRedis(
    mode: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ userId: string; rating: number }[]> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    const key = `leaderboard:${mode}`;

    // ZREVRANGE with scores (highest rating first)
    const results = await this.redis.zrevrange(key, start, end, 'WITHSCORES');

    // Parse results: [userId1, rating1, userId2, rating2, ...]
    const entries: { userId: string; rating: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        userId: results[i],
        rating: parseInt(results[i + 1], 10),
      });
    }

    return entries;
  }

  /**
   * Get total count of entries in leaderboard
   */
  async getLeaderboardCount(mode: string): Promise<number> {
    const key = `leaderboard:${mode}`;
    return await this.redis.zcard(key);
  }

  /**
   * Get user's rank in leaderboard
   * @returns 1-based rank, or null if not found
   */
  async getUserRank(userId: string, mode: string): Promise<number | null> {
    const key = `leaderboard:${mode}`;
    // ZREVRANK returns 0-based index, add 1 for 1-based rank
    const rank = await this.redis.zrevrank(key, userId);
    return rank !== null ? rank + 1 : null;
  }

  /**
   * Get leaderboard metadata (timestamp and game count)
   */
  async getLeaderboardMetadata(): Promise<{ last_updated: string; game_count: string } | null> {
    const data = await this.redis.hgetall('leaderboard:meta');
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return {
      last_updated: data.last_updated || '0',
      game_count: data.game_count || '0',
    };
  }

  /**
   * Set leaderboard metadata
   */
  async setLeaderboardMetadata(timestamp: string, gameCount: string): Promise<void> {
    await this.redis.hset('leaderboard:meta', {
      last_updated: timestamp,
      game_count: gameCount,
    });
  }

  /**
   * Rebuild leaderboard from PostgreSQL data
   * @param users - Array of {userId, rating} from PostgreSQL
   * @param mode - Game mode
   * @param timestamp - Current timestamp
   */
  async rebuildLeaderboard(
    users: { userId: string; rating: number }[],
    mode: string,
    timestamp: string,
    gameCount: string,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Clear existing sorted set
    pipeline.del(`leaderboard:${mode}`);

    // Add all users
    users.forEach((user) => {
      pipeline.zadd(`leaderboard:${mode}`, user.rating, user.userId);
    });

    // Update metadata
    pipeline.hset('leaderboard:meta', {
      last_updated: timestamp,
      game_count: gameCount,
    });

    await pipeline.exec();
    console.log(`[Redis] Rebuilt leaderboard:${mode} with ${users.length} users`);
  }

  /**
   * Clear leaderboard (for testing or manual rebuild)
   */
  async clearLeaderboard(mode?: string): Promise<void> {
    if (mode) {
      await this.redis.del(`leaderboard:${mode}`);
    } else {
      // Clear all leaderboards
      const keys = await this.redis.keys('leaderboard:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  /**
   * Check if Redis has leaderboard data
   */
  async hasLeaderboardData(mode: string): Promise<boolean> {
    const count = await this.redis.zcard(`leaderboard:${mode}`);
    return count > 0;
  }

}

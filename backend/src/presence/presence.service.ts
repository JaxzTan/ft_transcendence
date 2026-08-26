import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { secret } from '../secrets';

export type PresenceStatus = 'online' | 'playing' | 'offline';

// Heartbeats land every ~20s from the client (see store.tsx); the TTL covers
// two missed beats before a stale/closed tab reads back as offline.
const PRESENCE_TTL_S = 45;

/**
 * Presence state in Redis, same idiom as LeaderboardRedisService/MatchService:
 *  - `presence:{userId}` -> "online" | "playing", expiring after PRESENCE_TTL_S
 *
 * A missing key IS the offline state — nothing to clean up, TTL does it.
 */
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private redis: Redis;

  constructor() {
    // Host/port stay plain env — they're topology, not secrets.
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6479', 10);
    const password = secret('REDIS_PASSWORD');

    this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
    this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
  }

  onModuleDestroy() {
    this.redis.quit();
  }

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  async heartbeat(userId: string, playing: boolean): Promise<void> {
    await this.redis.set(this.key(userId), playing ? 'playing' : 'online', 'EX', PRESENCE_TTL_S);
  }

  /** Immediate offline on logout, rather than waiting out the TTL. */
  async clear(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  /** Single-user lookup — e.g. a profile page for one specific account. */
  async getStatus(userId: string): Promise<PresenceStatus> {
    const value = await this.redis.get(this.key(userId));
    return (value as PresenceStatus) ?? 'offline';
  }

  /** Batched lookup for a friends list — a missing key means the TTL lapsed. */
  async getStatuses(userIds: string[]): Promise<Record<string, PresenceStatus>> {
    if (userIds.length === 0) return {};
    const values = await this.redis.mget(userIds.map((id) => this.key(id)));
    const statuses: Record<string, PresenceStatus> = {};
    userIds.forEach((id, i) => {
      statuses[id] = (values[i] as PresenceStatus) ?? 'offline';
    });
    return statuses;
  }

  /** Site-wide online count for the homepage badge — same SCAN idiom as MatchQueryService. */
  async getOnlineCount(): Promise<number> {
    let cursor = '0';
    let count = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'presence:*', 'COUNT', 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
    return count;
  }
}

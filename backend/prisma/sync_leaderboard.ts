import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function secret(name: string): string | undefined {
  const dir = process.env.SECRETS_DIR ?? '/secrets';
  for (const base of [dir, join(process.cwd(), '..', 'secrets'), join(process.cwd(), 'secrets')]) {
    try {
      const value = readFileSync(join(base, `${name.toLowerCase()}.txt`), 'utf8').trim();
      if (value) return value;
    } catch {
      // ignore
    }
  }
  return process.env[name];
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const creds = secret('DB_CREDENTIALS');
  const pwd = secret('DB_PASSWORD');
  if (creds && pwd) {
    const parts = creds.split(':');
    const user = parts[0] || 'db_bossman';
    const db = parts[1] || 'transcendence';
    const host = parts[2] || (process.env.SECRETS_DIR ? 'db' : 'localhost');
    return `postgresql://${user}:${pwd}@${host}:5432/${db}`;
  }
  return secret('DATABASE_URL') || '';
}

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Synchronizing database users to Redis & Leaderboard Snapshot...');

  const users = await prisma.user.findMany({
    orderBy: { rating: 'desc' },
  });

  console.log(`Found ${users.length} total users in PostgreSQL database.`);

  // Connect to Redis
  const redisHost = process.env.REDIS_HOST || (process.env.SECRETS_DIR ? 'redis' : 'localhost');
  const redisPort = parseInt(process.env.REDIS_PORT || '6479', 10);
  const redisPassword = secret('REDIS_PASSWORD') || 'password123';

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
  });

  // Clear Redis leaderboards
  await redis.del('leaderboard:global', 'leaderboard:ranked', 'leaderboard:casual');

  // Populate Redis sorted sets
  for (const u of users) {
    await redis.zadd('leaderboard:global', u.rating, u.id);
    await redis.zadd('leaderboard:ranked', u.rating, u.id);
    await redis.zadd('leaderboard:casual', u.rating, u.id);
  }

  const count = await redis.zcard('leaderboard:global');
  console.log(`✅ Successfully added ${count} users to Redis leaderboard:global!`);

  // Also refresh snapshot
  await prisma.leaderboardSnapshot.deleteMany({});
  await prisma.leaderboardSnapshot.createMany({
    data: users.map((u, i) => ({
      id: randomUUID(),
      mode: 'global',
      userId: u.id,
      username: u.username,
      rating: u.rating,
      rank: i + 1,
    })),
  });

  console.log(`✅ Refreshed PostgreSQL LeaderboardSnapshot table with ${users.length} rows.`);

  await redis.quit();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Leaderboard sync failed:', err);
  process.exit(1);
});

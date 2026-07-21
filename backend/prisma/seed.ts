import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Inlined rather than imported from src/secrets.ts: the seed runs via ts-node
// in the runtime image, which ships prisma/ but not src/. Mirrors prisma.config.ts.
function secret(name: string): string | undefined {
  const dir = process.env.SECRETS_DIR ?? '/secrets';
  for (const base of [dir, join(process.cwd(), '..', 'secrets')]) {
    try {
      const value = readFileSync(join(base, `${name.toLowerCase()}.txt`), 'utf8').trim();
      if (value) return value;
    } catch {
      // try next location
    }
  }
  return process.env[name];
}

// Prisma 7 requires a driver adapter — mirrors src/prisma.service.ts.
// env-first for the same reason as prisma.config.ts / prisma.service.ts.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || secret('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding Ludo database...');

  // ── Users ─────────────────────────────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'Alice',
      email: 'alice@example.com',
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2', // password: "password"
      rating: 1200,
      highestRating: 1250,
      rankedWins: 2,
      rankedLosses: 1,
      avatarStyle: 'bottts',
      status: 'online',
      isOnline: true,
      gamesWithFourPieces: 2,
      gamesWithThreePieces: 1,
      gamesWithZeroPieces: 1,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'Bob',
      email: 'bob@example.com',
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2',
      rating: 1100,
      highestRating: 1150,
      rankedWins: 1,
      rankedLosses: 2,
      avatarStyle: 'avataaars',
      status: 'online',
      isOnline: true,
      gamesWithTwoPieces: 1,
      gamesWithOnePiece: 1,
      gamesWithFourPieces: 1,
    },
  });

  const carol = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'Carol',
      email: 'carol@example.com',
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2',
      rating: 1050,
      highestRating: 1100,
      rankedLosses: 1,
      avatarStyle: 'identicon',
      status: 'offline',
      isOnline: false,
      gamesWithThreePieces: 1,
    },
  });

  const dave = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'Dave',
      email: 'dave@example.com',
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2',
      rating: 1000,
      highestRating: 1000,
      rankedLosses: 1,
      avatarStyle: 'bottts',
      status: 'offline',
      isOnline: false,
      gamesWithZeroPieces: 1,
    },
  });

  console.log('  Created users: Alice, Bob, Carol, Dave');

  // ── A completed 4-player ranked game (Alice 1st with all 4 pieces home) ────
  const startedAt = new Date(Date.now() - 3600000);
  const endedAt = new Date();

  await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      startedAt,
      endedAt,
      durationSeconds: Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
      status: 'COMPLETED',
      gameType: 'PVP',
      participants: {
        create: [
          {
            id: crypto.randomUUID(),
            user_id: alice.id,
            color: 'RED',
            rank: 1,
            totalTurns: 32,
            piecesCaptured: 5,
            piecesInGoal: 4,
          },
          {
            id: crypto.randomUUID(),
            user_id: bob.id,
            color: 'GREEN',
            rank: 2,
            totalTurns: 30,
            piecesCaptured: 3,
            piecesInGoal: 2,
          },
          {
            id: crypto.randomUUID(),
            user_id: carol.id,
            color: 'YELLOW',
            rank: 3,
            totalTurns: 29,
            piecesCaptured: 1,
            piecesInGoal: 1,
          },
          {
            id: crypto.randomUUID(),
            user_id: dave.id,
            color: 'BLUE',
            rank: 4,
            totalTurns: 28,
            piecesCaptured: 0,
            piecesInGoal: 0,
          },
        ],
      },
    },
  });

  console.log('  Created completed 4-player game');

  // ── A completed head-to-head game vs a bot (PVE) ──────────────────────────
  const pveStart = new Date(Date.now() - 7200000);
  const pveEnd = new Date(Date.now() - 6600000);

  await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      startedAt: pveStart,
      endedAt: pveEnd,
      durationSeconds: Math.floor((pveEnd.getTime() - pveStart.getTime()) / 1000),
      status: 'COMPLETED',
      gameType: 'PVE',
      participants: {
        create: [
          {
            id: crypto.randomUUID(),
            user_id: bob.id,
            color: 'RED',
            rank: 1,
            totalTurns: 24,
            piecesCaptured: 2,
            piecesInGoal: 4,
          },
          {
            id: crypto.randomUUID(),
            user_id: carol.id,
            color: 'BLUE',
            rank: 2,
            totalTurns: 23,
            piecesCaptured: 1,
            piecesInGoal: 3,
          },
        ],
      },
    },
  });

  console.log('  Created completed PVE game');

  // ── An abandoned game ─────────────────────────────────────────────────────
  const abStart = new Date(Date.now() - 1800000);
  const abEnd = new Date(Date.now() - 1500000);

  await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      startedAt: abStart,
      endedAt: abEnd,
      durationSeconds: Math.floor((abEnd.getTime() - abStart.getTime()) / 1000),
      status: 'ABANDONED',
      gameType: 'PVP',
      inviteCode: 'LUDO42',
      participants: {
        create: [
          {
            id: crypto.randomUUID(),
            user_id: alice.id,
            color: 'GREEN',
            rank: 1,
            totalTurns: 8,
            piecesCaptured: 0,
            piecesInGoal: 0,
          },
          {
            id: crypto.randomUUID(),
            user_id: dave.id,
            color: 'YELLOW',
            rank: 2,
            totalTurns: 7,
            piecesCaptured: 0,
            piecesInGoal: 0,
          },
        ],
      },
    },
  });

  console.log('  Created abandoned game');

  // ── Friendships ───────────────────────────────────────────────────────────
  await prisma.friendship.create({
    data: {
      id: crypto.randomUUID(),
      userId: alice.id,
      friendId: bob.id,
      status: 'accepted',
    },
  });

  await prisma.friendship.create({
    data: {
      id: crypto.randomUUID(),
      userId: carol.id,
      friendId: alice.id,
      status: 'pending',
    },
  });

  console.log('  Created friendships');
  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

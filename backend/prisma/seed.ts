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

// Fixture rows carry stable ids instead of crypto.randomUUID() so a re-run
// lands on the same rows rather than inserting a second copy of everything.
const SEED_USERNAMES = ['Alice', 'Bob', 'Carol', 'Dave'];

// bcrypt hash of "password"
const PASSWORD_HASH = '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2';

async function main() {
  console.log('🌱 Seeding Ludo database...');

  // ── Reset previous seed data ──────────────────────────────────────────────
  // Deleting the fixture users cascades their GameParticipant and Friendship
  // rows (onDelete: Cascade on both), which leaves the fixture games with no
  // participants; the second delete sweeps those. A real match always has
  // participants, so genuine game history is never touched. This also cleans up
  // rows left by earlier runs that used random UUIDs.
  await prisma.user.deleteMany({ where: { username: { in: SEED_USERNAMES } } });
  await prisma.game.deleteMany({ where: { participants: { none: {} } } });

  // ── Users ─────────────────────────────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      id: 'seed-user-alice',
      username: 'Alice',
      email: 'alice@example.com',
      password_hash: PASSWORD_HASH,
      rating: 1200,
      highestRating: 1250,
      wins: 2,
      losses: 1,
      avatarStyle: 'bottts',
      status: 'online',
      gamesWithFourPieces: 2,
      gamesWithThreePieces: 1,
      gamesWithZeroPieces: 1,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: 'seed-user-bob',
      username: 'Bob',
      email: 'bob@example.com',
      password_hash: PASSWORD_HASH,
      rating: 1100,
      highestRating: 1150,
      wins: 1,
      losses: 2,
      avatarStyle: 'avataaars',
      status: 'online',
      gamesWithTwoPieces: 1,
      gamesWithOnePiece: 1,
      gamesWithFourPieces: 1,
    },
  });

  const carol = await prisma.user.create({
    data: {
      id: 'seed-user-carol',
      username: 'Carol',
      email: 'carol@example.com',
      password_hash: PASSWORD_HASH,
      rating: 1050,
      highestRating: 1100,
      losses: 1,
      avatarStyle: 'identicon',
      status: 'offline',
      gamesWithThreePieces: 1,
    },
  });

  const dave = await prisma.user.create({
    data: {
      id: 'seed-user-dave',
      username: 'Dave',
      email: 'dave@example.com',
      password_hash: PASSWORD_HASH,
      rating: 1000,
      highestRating: 1000,
      losses: 1,
      avatarStyle: 'bottts',
      status: 'offline',
      gamesWithZeroPieces: 1,
    },
  });

  console.log('  Created users: Alice, Bob, Carol, Dave');

  // ── A completed 4-player ranked game (Alice 1st with all 4 pieces home) ────
  const startedAt = new Date(Date.now() - 3600000);
  const endedAt = new Date();

  await prisma.game.create({
    data: {
      id: 'seed-game-pvp',
      startedAt,
      endedAt,
      status: 'COMPLETED',
      gameType: 'PVP',
      participants: {
        create: [
          {
            id: 'seed-part-pvp-red',
            user_id: alice.id,
            color: 'RED',
            rank: 1,
            piecesCaptured: 5,
            piecesInGoal: 4,
          },
          {
            id: 'seed-part-pvp-green',
            user_id: bob.id,
            color: 'GREEN',
            rank: 2,
            piecesCaptured: 3,
            piecesInGoal: 2,
          },
          {
            id: 'seed-part-pvp-yellow',
            user_id: carol.id,
            color: 'YELLOW',
            rank: 3,
            piecesCaptured: 1,
            piecesInGoal: 1,
          },
          {
            id: 'seed-part-pvp-blue',
            user_id: dave.id,
            color: 'BLUE',
            rank: 4,
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
      id: 'seed-game-pve',
      startedAt: pveStart,
      endedAt: pveEnd,
      status: 'COMPLETED',
      gameType: 'PVE',
      participants: {
        create: [
          {
            id: 'seed-part-pve-red',
            user_id: bob.id,
            color: 'RED',
            rank: 1,
            piecesCaptured: 2,
            piecesInGoal: 4,
          },
          {
            id: 'seed-part-pve-blue',
            user_id: carol.id,
            color: 'BLUE',
            rank: 2,
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
      id: 'seed-game-abandoned',
      startedAt: abStart,
      endedAt: abEnd,
      status: 'ABANDONED',
      gameType: 'PVP',
      inviteCode: 'LUDO42',
      participants: {
        create: [
          {
            id: 'seed-part-abandoned-green',
            user_id: alice.id,
            color: 'GREEN',
            rank: 1,
            piecesCaptured: 0,
            piecesInGoal: 0,
          },
          {
            id: 'seed-part-abandoned-yellow',
            user_id: dave.id,
            color: 'YELLOW',
            rank: 2,
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
      id: 'seed-friendship-alice-bob',
      userId: alice.id,
      friendId: bob.id,
      status: 'accepted',
    },
  });

  await prisma.friendship.create({
    data: {
      id: 'seed-friendship-carol-alice',
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

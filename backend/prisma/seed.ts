import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
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

// Fixture rows get real randomUUID() ids, exactly like rows created through
// auth.service.ts / match.service.ts — nothing downstream may assume a seeded
// id is recognisable. Re-runs stay idempotent through the reset below, which
// keys off username rather than id.
const SEED_USERNAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];

// Hashed at seed time with the same algorithm and cost as registration
// (auth.service.ts), so every fixture login goes through the real bcrypt.compare
// path. Each user gets its own salt, as a real signup would.
const SALT_ROUNDS = 10;
const SEED_PASSWORD = 'password';

const hashPassword = () => bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

const HOUR = 3600_000;
const MINUTE = 60_000;
const now = Date.now();

async function main() {
  console.log('🌱 Seeding Ludo database...');

  // ── Reset previous seed data ──────────────────────────────────────────────
  // Deleting the fixture users cascades their Account, GameParticipant and
  // Friendship rows (onDelete: Cascade on all three), which leaves the fixture
  // games with no participants at all; the second delete sweeps those. A real
  // match always has at least one participant that outlives this reset, so
  // genuine game history is never touched.
  await prisma.user.deleteMany({ where: { username: { in: SEED_USERNAMES } } });
  await prisma.game.deleteMany({ where: { participants: { none: {} } } });

  // ── Users ─────────────────────────────────────────────────────────────────
  // Counters below are derived from the games seeded further down, using the
  // same rules as match.service.ts (+10 rating per win, -5 per loss; ABANDONED
  // games count for nothing) and achievements.service.ts. Every fixture game is
  // PVP, so humanWins/botWins stay at their defaults.
  const alice = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Alice',
      email: 'alice@example.com',
      emailVerified: new Date(now - 30 * 24 * HOUR),
      password_hash: await hashPassword(),
      // 2FA off so `Alice` / `password` logs straight in locally (no emailed
      // code). Bob keeps it on to exercise the twoFactorRequired path.
      twoFactorEnabled: false,
      rating: 1220,          // 1200 + 10 + 10
      highestRating: 1220,
      wins: 2,
      losses: 0,
      humanWins: 2,
      botWins: 0,
      winStreak: 2,
      bestWinStreak: 2,
      lastLoginAt: new Date(now - 20 * MINUTE),
      loginStreak: 4,
      daysActive: 12,
      avatarStyle: 'bottts',
      status: 'online',
      disconnectCount: 1,
      reconnectCount: 1,
      gamesWithFourPieces: 2,
      // First win; 3 captures in one game; won with 4 home while every
      // opponent had >= 1 home; the 25-minute win clears Speed Demon.
      achFirstBlood: true,
      achUnstoppable: true,
      achLastLaugh: true,
      achSpeedDemon: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Bob',
      email: 'bob@example.com',
      emailVerified: new Date(now - 25 * 24 * HOUR),
      password_hash: await hashPassword(),
      // Left ON: logging in as Bob exercises the emailed-code 2FA flow.
      twoFactorEnabled: true,
      rating: 1095,          // 1100 - 5
      highestRating: 1100,
      wins: 0,
      losses: 1,
      winStreak: 0,
      bestWinStreak: 0,
      lastLoginAt: new Date(now - 2 * HOUR),
      loginStreak: 2,
      daysActive: 8,
      avatarStyle: 'avataaars',
      status: 'playing',
      disconnectCount: 2,
      reconnectCount: 2,
      gamesWithTwoPieces: 1,
      // 3 captures in the 4-player game. The win-gated achievements are all
      // false now that Bob has no completed win.
      achUnstoppable: true,
    },
  });

  const carol = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Carol',
      email: 'carol@example.com',
      emailVerified: new Date(now - 10 * 24 * HOUR),
      password_hash: await hashPassword(),
      twoFactorEnabled: false,
      rating: 1045,          // 1050 - 5
      highestRating: 1050,
      wins: 0,
      losses: 1,
      lastLoginAt: new Date(now - 3 * 24 * HOUR),
      loginStreak: 0,
      daysActive: 3,
      avatarStyle: 'identicon',
      status: 'offline',
      gamesWithOnePiece: 1,
    },
  });

  const dave = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Dave',
      email: 'dave@example.com',
      // Unverified: exercises the "signed up but never confirmed" path.
      password_hash: await hashPassword(),
      twoFactorEnabled: false,
      rating: 990,           // 1000 - 5 - 5
      highestRating: 1000,
      wins: 0,
      losses: 2,
      lastLoginAt: new Date(now - 6 * HOUR),
      loginStreak: 1,
      daysActive: 2,
      avatarStyle: 'bottts',
      status: 'offline',
      disconnectCount: 3,
      reconnectCount: 1,
      gamesWithZeroPieces: 1,
      gamesWithOnePiece: 1,
    },
  });

  // OAuth-only user: no password_hash, identity lives in Account.
  const eve = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Eve',
      email: 'eve@example.com',
      emailVerified: new Date(now - 5 * 24 * HOUR),
      // OAuth-only, but finishOAuth still honours this flag, so keep it off.
      twoFactorEnabled: false,
      rating: 995,           // 1000 - 5
      highestRating: 1000,
      wins: 0,
      losses: 1,
      lastLoginAt: new Date(now - 45 * MINUTE),
      loginStreak: 3,
      daysActive: 5,
      avatarStyle: 'avataaars',
      status: 'online',
      gamesWithThreePieces: 1,
      accounts: {
        create: [
          {
            id: randomUUID(),
            provider: 'google',
            providerAccountId: 'google-oauth2|seed-eve',
          },
        ],
      },
    },
  });

  console.log('  Created users: Alice, Bob, Carol, Dave, Eve');

  // ── A completed 4-player game (Alice 1st with all 4 pieces home) ───────────
  await prisma.game.create({
    data: {
      id: randomUUID(),
      startedAt: new Date(now - 4 * HOUR),
      endedAt: new Date(now - 3 * HOUR),
      status: 'COMPLETED',
      gameType: 'PVP',
      participants: {
        create: [
          { id: randomUUID(), user_id: alice.id, color: 'RED', rank: 1, piecesCaptured: 5, piecesInGoal: 4 },
          { id: randomUUID(), user_id: bob.id, color: 'GREEN', rank: 2, piecesCaptured: 3, piecesInGoal: 2 },
          { id: randomUUID(), user_id: carol.id, color: 'YELLOW', rank: 3, piecesCaptured: 1, piecesInGoal: 1 },
          { id: randomUUID(), user_id: dave.id, color: 'BLUE', rank: 4, piecesCaptured: 0, piecesInGoal: 0 },
        ],
      },
    },
  });

  console.log('  Created completed 4-player game');

  // ── A completed 3-player game — 25 min, so Alice clears Speed Demon ────────
  await prisma.game.create({
    data: {
      id: randomUUID(),
      startedAt: new Date(now - 90 * MINUTE),
      endedAt: new Date(now - 65 * MINUTE),
      status: 'COMPLETED',
      gameType: 'PVP',
      participants: {
        create: [
          { id: randomUUID(), user_id: alice.id, color: 'RED', rank: 1, piecesCaptured: 4, piecesInGoal: 4 },
          { id: randomUUID(), user_id: eve.id, color: 'GREEN', rank: 2, piecesCaptured: 2, piecesInGoal: 3 },
          { id: randomUUID(), user_id: dave.id, color: 'YELLOW', rank: 3, piecesCaptured: 0, piecesInGoal: 1 },
        ],
      },
    },
  });

  console.log('  Created completed 3-player game');

  // ── An abandoned invite game (counts toward no stats) ─────────────────────
  await prisma.game.create({
    data: {
      id: randomUUID(),
      startedAt: new Date(now - 30 * MINUTE),
      endedAt: new Date(now - 25 * MINUTE),
      status: 'ABANDONED',
      gameType: 'PVP',
      inviteCode: 'LUDO42',
      participants: {
        create: [
          { id: randomUUID(), user_id: alice.id, color: 'GREEN', rank: 1, piecesCaptured: 0, piecesInGoal: 0 },
          { id: randomUUID(), user_id: dave.id, color: 'YELLOW', rank: 2, piecesCaptured: 0, piecesInGoal: 0 },
        ],
      },
    },
  });

  console.log('  Created abandoned game');

  // ── Friendships (one per status) ──────────────────────────────────────────
  await prisma.friendship.createMany({
    data: [
      { id: randomUUID(), userId: alice.id, friendId: bob.id, status: 'accepted' },
      { id: randomUUID(), userId: alice.id, friendId: eve.id, status: 'accepted' },
      { id: randomUUID(), userId: carol.id, friendId: alice.id, status: 'pending' },
      { id: randomUUID(), userId: bob.id, friendId: dave.id, status: 'blocked' },
    ],
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

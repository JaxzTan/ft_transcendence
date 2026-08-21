import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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

const SEED_USERNAMES = [
  'Viper_X',
  'NeonKnight',
  'Alice',
  'ShadowFox',
  'CyberSamurai',
  'StarLord',
  'Bob',
  'CheeseRing',
  'Carol',
  'ChocoRookie',
  'Dave',
  'Eve',
];

const SALT_ROUNDS = 10;
const SEED_PASSWORD = 'password';

const hashPassword = () => bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

const HOUR = 3600_000;
const MINUTE = 60_000;
const now = Date.now();

async function main() {
  console.log('🌱 Seeding Ludo database with Malaysian Snack Ranks...');

  // ── Reset previous seed data ──────────────────────────────────────────────
  await prisma.user.deleteMany({ where: { username: { in: SEED_USERNAMES } } });
  await prisma.game.deleteMany({ where: { participants: { none: {} } } });
  await prisma.leaderboardSnapshot.deleteMany({ where: { username: { in: SEED_USERNAMES } } });

  const pwd = await hashPassword();

  // ── 1. MAMEE MONSTER (Top 3 Players) ──────────────────────────────────────
  const viper = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Viper_X',
      email: 'viper@example.com',
      emailVerified: new Date(now - 45 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1650, // Rank #1
      highestRating: 1680,
      wins: 28,
      losses: 5,
      humanWins: 24,
      botWins: 4,
      winStreak: 8,
      bestWinStreak: 12,
      avatarStyle: 'bottts',
      status: 'online',
      gamesWithFourPieces: 20,
      achFirstBlood: true,
      achUnstoppable: true,
      achMaster: true,
      achWorldChampion: true,
      achOnFire: true,
    },
  });

  const neonKnight = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'NeonKnight',
      email: 'neon@example.com',
      emailVerified: new Date(now - 40 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1540, // Rank #2
      highestRating: 1560,
      wins: 22,
      losses: 7,
      humanWins: 19,
      botWins: 3,
      winStreak: 5,
      bestWinStreak: 9,
      avatarStyle: 'avataaars',
      status: 'playing',
      gamesWithFourPieces: 15,
      achFirstBlood: true,
      achTactician: true,
      achSpeedDemon: true,
    },
  });

  const alice = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Alice',
      email: 'alice@example.com',
      emailVerified: new Date(now - 30 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1420, // Rank #3
      highestRating: 1440,
      wins: 18,
      losses: 6,
      humanWins: 15,
      botWins: 3,
      winStreak: 4,
      bestWinStreak: 6,
      avatarStyle: 'bottts',
      status: 'online',
      gamesWithFourPieces: 12,
      achFirstBlood: true,
      achUnstoppable: true,
      achLastLaugh: true,
      achSpeedDemon: true,
    },
  });

  // ── 2. MILO DINOSAUR (Rating >= 1350, Rank 4+) ─────────────────────────────
  const shadowFox = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'ShadowFox',
      email: 'shadow@example.com',
      emailVerified: new Date(now - 28 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1390, // Rank #4
      highestRating: 1400,
      wins: 15,
      losses: 8,
      humanWins: 13,
      botWins: 2,
      winStreak: 3,
      bestWinStreak: 5,
      avatarStyle: 'identicon',
      status: 'online',
      gamesWithFourPieces: 10,
      achFirstBlood: true,
      achTactician: true,
    },
  });

  const cyberSamurai = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'CyberSamurai',
      email: 'samurai@example.com',
      emailVerified: new Date(now - 25 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1360, // Rank #5
      highestRating: 1380,
      wins: 14,
      losses: 9,
      humanWins: 12,
      botWins: 2,
      winStreak: 2,
      bestWinStreak: 4,
      avatarStyle: 'avataaars',
      status: 'offline',
      gamesWithFourPieces: 9,
      achFirstBlood: true,
    },
  });

  // ── 3. HONEY STARS (Rating 1200 - 1349) ───────────────────────────────────
  const starLord = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'StarLord',
      email: 'starlord@example.com',
      emailVerified: new Date(now - 20 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1290, // Rank #6
      highestRating: 1310,
      wins: 11,
      losses: 8,
      humanWins: 10,
      botWins: 1,
      winStreak: 2,
      bestWinStreak: 3,
      avatarStyle: 'bottts',
      status: 'online',
      gamesWithFourPieces: 7,
      achFirstBlood: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Bob',
      email: 'bob@example.com',
      emailVerified: new Date(now - 25 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: true,
      rating: 1230, // Rank #7
      highestRating: 1250,
      wins: 9,
      losses: 7,
      winStreak: 1,
      bestWinStreak: 3,
      avatarStyle: 'avataaars',
      status: 'playing',
      gamesWithFourPieces: 5,
      achUnstoppable: true,
    },
  });

  // ── 4. SUPER RING (Rating 1000 - 1199) ────────────────────────────────────
  const cheeseRing = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'CheeseRing',
      email: 'cheese@example.com',
      emailVerified: new Date(now - 15 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1140, // Rank #8
      highestRating: 1160,
      wins: 6,
      losses: 7,
      winStreak: 1,
      bestWinStreak: 2,
      avatarStyle: 'identicon',
      status: 'online',
      gamesWithFourPieces: 3,
      achFirstBlood: true,
    },
  });

  const carol = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Carol',
      email: 'carol@example.com',
      emailVerified: new Date(now - 10 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 1070, // Rank #9
      highestRating: 1100,
      wins: 4,
      losses: 6,
      avatarStyle: 'identicon',
      status: 'offline',
      gamesWithFourPieces: 2,
    },
  });

  // ── 5. CHOKI CHOKI (Rating < 1000) ────────────────────────────────────────
  const chocoRookie = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'ChocoRookie',
      email: 'choco@example.com',
      emailVerified: new Date(now - 7 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 950, // Rank #10
      highestRating: 980,
      wins: 2,
      losses: 5,
      avatarStyle: 'bottts',
      status: 'online',
      gamesWithFourPieces: 1,
    },
  });

  const dave = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Dave',
      email: 'dave@example.com',
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 880, // Rank #11
      highestRating: 920,
      wins: 1,
      losses: 6,
      avatarStyle: 'bottts',
      status: 'offline',
      gamesWithFourPieces: 1,
    },
  });

  const eve = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'Eve',
      email: 'eve@example.com',
      emailVerified: new Date(now - 5 * 24 * HOUR),
      password_hash: pwd,
      twoFactorEnabled: false,
      rating: 780, // Rank #12
      highestRating: 820,
      wins: 0,
      losses: 5,
      avatarStyle: 'avataaars',
      status: 'online',
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

  const allUsers = [
    viper,
    neonKnight,
    alice,
    shadowFox,
    cyberSamurai,
    starLord,
    bob,
    cheeseRing,
    carol,
    chocoRookie,
    dave,
    eve,
  ];

  console.log(`  Created ${allUsers.length} users across all 5 snack ranks!`);

  // ── Leaderboard Snapshot (All Users in Database) ──────────────────────────
  await prisma.leaderboardSnapshot.deleteMany({});
  const allPilots = await prisma.user.findMany({ orderBy: { rating: 'desc' } });
  await prisma.leaderboardSnapshot.createMany({
    data: allPilots.map((u, i) => ({
      id: randomUUID(),
      mode: 'global',
      userId: u.id,
      username: u.username,
      rating: u.rating,
      rank: i + 1,
    })),
  });

  console.log(`  Created global leaderboard snapshot covering all ${allPilots.length} pilots!`);

  // ── Sample Matches ────────────────────────────────────────────────────────
  await prisma.game.create({
    data: {
      id: randomUUID(),
      startedAt: new Date(now - 2 * HOUR),
      endedAt: new Date(now - 90 * MINUTE),
      status: 'COMPLETED',
      gameType: 'PVP',
      participants: {
        create: [
          { id: randomUUID(), user_id: viper.id, color: 'RED', rank: 1, piecesCaptured: 6, piecesInGoal: 4 },
          { id: randomUUID(), user_id: neonKnight.id, color: 'GREEN', rank: 2, piecesCaptured: 3, piecesInGoal: 3 },
          { id: randomUUID(), user_id: alice.id, color: 'YELLOW', rank: 3, piecesCaptured: 2, piecesInGoal: 2 },
          { id: randomUUID(), user_id: shadowFox.id, color: 'BLUE', rank: 4, piecesCaptured: 1, piecesInGoal: 1 },
        ],
      },
    },
  });

  // ── Friendships ───────────────────────────────────────────────────────────
  const otherUsers = await prisma.user.findMany({
    where: { username: { notIn: SEED_USERNAMES } },
    select: { id: true, username: true },
  });

  const friendshipsToCreate: Array<{ id: string; userId: string; friendId: string; status: 'accepted' | 'pending' | 'blocked' }> = [
    { id: randomUUID(), userId: alice.id, friendId: bob.id, status: 'accepted' },
    { id: randomUUID(), userId: alice.id, friendId: viper.id, status: 'accepted' },
    { id: randomUUID(), userId: alice.id, friendId: neonKnight.id, status: 'accepted' },
    { id: randomUUID(), userId: bob.id, friendId: shadowFox.id, status: 'accepted' },
    { id: randomUUID(), userId: carol.id, friendId: alice.id, status: 'pending' },
    { id: randomUUID(), userId: chocoRookie.id, friendId: dave.id, status: 'accepted' },
  ];

  for (const other of otherUsers) {
    friendshipsToCreate.push(
      { id: randomUUID(), userId: other.id, friendId: alice.id, status: 'accepted' },
      { id: randomUUID(), userId: other.id, friendId: viper.id, status: 'accepted' },
      { id: randomUUID(), userId: other.id, friendId: neonKnight.id, status: 'accepted' },
      { id: randomUUID(), userId: other.id, friendId: shadowFox.id, status: 'accepted' },
    );
  }

  await prisma.friendship.createMany({
    data: friendshipsToCreate,
  });

  console.log('✅ Seeding complete with all 5 Snack Rank Tiers represented!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

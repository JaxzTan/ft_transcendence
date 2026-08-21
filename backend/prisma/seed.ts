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

const SEED_PLAYERS = [
  // ── MAMEE MONSTER (Top 3 Contenders) ──────────────────────────────
  { username: 'Viper_X', rating: 1650, wins: 34, losses: 6, avatar: 'bottts', status: 'online' },
  
  // ── MILO DINOSAUR (Rating >= 1350) ──────────────────────────────
  { username: 'NeonKnight', rating: 1540, wins: 28, losses: 9, avatar: 'avataaars', status: 'playing' },
  { username: 'Alice', rating: 1480, wins: 25, losses: 10, avatar: 'identicon', status: 'online' },
  { username: 'ShadowFox', rating: 1440, wins: 22, losses: 11, avatar: 'bottts', status: 'offline' },
  { username: 'CyberSamurai', rating: 1410, wins: 20, losses: 12, avatar: 'shapes', status: 'online' },
  { username: 'HyperNova', rating: 1390, wins: 19, losses: 11, avatar: 'bottts', status: 'playing' },
  { username: 'GhostRunner', rating: 1370, wins: 18, losses: 13, avatar: 'avataaars', status: 'offline' },
  { username: 'AeroBlade', rating: 1355, wins: 17, losses: 12, avatar: 'identicon', status: 'online' },

  // ── HONEY STARS (Rating 1200 - 1349) ────────────────────────────
  { username: 'StarLord', rating: 1340, wins: 16, losses: 14, avatar: 'bottts', status: 'online' },
  { username: 'PixelMage', rating: 1320, wins: 15, losses: 13, avatar: 'shapes', status: 'playing' },
  { username: 'QuantumVolt', rating: 1290, wins: 14, losses: 12, avatar: 'avataaars', status: 'offline' },
  { username: 'Bob', rating: 1270, wins: 13, losses: 13, avatar: 'bottts', status: 'online' },
  { username: 'CircuitBreaker', rating: 1250, wins: 12, losses: 14, avatar: 'identicon', status: 'offline' },
  { username: 'SolarFlare', rating: 1220, wins: 11, losses: 15, avatar: 'shapes', status: 'online' },
  { username: 'LaserFang', rating: 1205, wins: 10, losses: 14, avatar: 'bottts', status: 'playing' },

  // ── SUPER RING (Rating 1000 - 1199) ─────────────────────────────
  { username: 'CheeseRing', rating: 1180, wins: 10, losses: 16, avatar: 'avataaars', status: 'online' },
  { username: 'NightOwl', rating: 1150, wins: 9, losses: 16, avatar: 'identicon', status: 'offline' },
  { username: 'Carol', rating: 1120, wins: 8, losses: 15, avatar: 'shapes', status: 'playing' },
  { username: 'RetroRider', rating: 1090, wins: 7, losses: 16, avatar: 'bottts', status: 'online' },
  { username: 'TurboSnack', rating: 1060, wins: 6, losses: 15, avatar: 'avataaars', status: 'offline' },
  { username: 'VortexRogue', rating: 1030, wins: 5, losses: 16, avatar: 'identicon', status: 'online' },
  { username: 'MechaPawn', rating: 1005, wins: 5, losses: 18, avatar: 'shapes', status: 'offline' },

  // ── CHOKI CHOKI (Rating < 1000) ─────────────────────────────────
  { username: 'ChocoRookie', rating: 980, wins: 4, losses: 18, avatar: 'bottts', status: 'online' },
  { username: 'Dave', rating: 920, wins: 3, losses: 19, avatar: 'identicon', status: 'offline' },
  { username: 'BitDrifter', rating: 860, wins: 2, losses: 20, avatar: 'shapes', status: 'playing' },
  { username: 'Eve', rating: 780, wins: 1, losses: 22, avatar: 'avataaars', status: 'offline' },
  { username: 'ZeroCool', rating: 720, wins: 1, losses: 25, avatar: 'bottts', status: 'online' },
  { username: 'NeonSprout', rating: 650, wins: 0, losses: 24, avatar: 'identicon', status: 'offline' },
];

const SALT_ROUNDS = 10;
const SEED_PASSWORD = 'password';
const hashPassword = () => bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

const HOUR = 3600_000;
const MINUTE = 60_000;
const now = Date.now();

async function main() {
  console.log('🌱 Seeding Ludo database with expanded 28-player Cyber Roster...');

  const seedUsernames = SEED_PLAYERS.map((p) => p.username);

  // ── Reset previous seed data ──────────────────────────────────────────────
  await prisma.user.deleteMany({ where: { username: { in: seedUsernames } } });
  await prisma.game.deleteMany({ where: { participants: { none: {} } } });
  await prisma.leaderboardSnapshot.deleteMany({ where: { username: { in: seedUsernames } } });

  const pwd = await hashPassword();

  // ── Create All Seed Players ───────────────────────────────────────────────
  const createdUsers: any[] = [];
  for (let i = 0; i < SEED_PLAYERS.length; i++) {
    const p = SEED_PLAYERS[i];
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        username: p.username,
        email: `${p.username.toLowerCase()}@transcendence.cyber`,
        emailVerified: new Date(now - (50 - i) * 24 * HOUR),
        password_hash: pwd,
        twoFactorEnabled: false,
        rating: p.rating,
        highestRating: p.rating + Math.floor(Math.random() * 40),
        wins: p.wins,
        losses: p.losses,
        humanWins: Math.max(0, p.wins - 2),
        botWins: Math.min(2, p.wins),
        winStreak: Math.max(0, Math.floor(p.wins / 4)),
        bestWinStreak: Math.max(1, Math.floor(p.wins / 2)),
        avatarStyle: p.avatar,
        status: p.status as any,
        gamesWithFourPieces: Math.floor(p.wins * 0.7),
        achFirstBlood: p.wins > 0,
        achOnFire: p.wins >= 10,
        achTactician: p.wins >= 15,
        achMaster: p.rating >= 1400,
        achWorldChampion: p.rating >= 1600,
      },
    });
    createdUsers.push(user);
  }

  console.log(`  ✅ Created ${createdUsers.length} seed operatives!`);

  // ── Refresh Leaderboard Snapshot for ALL Database Users ────────────────────
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

  console.log(`  ✅ Created global leaderboard snapshot covering ${allPilots.length} total database pilots!`);

  // ── Sample Matches ────────────────────────────────────────────────────────
  if (createdUsers.length >= 4) {
    await prisma.game.create({
      data: {
        id: randomUUID(),
        startedAt: new Date(now - 2 * HOUR),
        endedAt: new Date(now - 90 * MINUTE),
        status: 'COMPLETED',
        gameType: 'PVP',
        participants: {
          create: [
            { id: randomUUID(), user_id: createdUsers[0].id, color: 'RED', rank: 1, piecesCaptured: 6, piecesInGoal: 4 },
            { id: randomUUID(), user_id: createdUsers[1].id, color: 'GREEN', rank: 2, piecesCaptured: 3, piecesInGoal: 3 },
            { id: randomUUID(), user_id: createdUsers[2].id, color: 'YELLOW', rank: 3, piecesCaptured: 2, piecesInGoal: 2 },
            { id: randomUUID(), user_id: createdUsers[3].id, color: 'BLUE', rank: 4, piecesCaptured: 1, piecesInGoal: 1 },
          ],
        },
      },
    });
  }

  console.log('✅ Seeding complete with full active roster across all Snack Rank Tiers!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

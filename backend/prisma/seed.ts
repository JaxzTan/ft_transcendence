import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, GameStatus } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 3 users
  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      id: 'user-alice',
      username: 'alice',
      password_hash: '$2b$10$dummyhashforalicelol111111111111111111111111111',
    },
  });

  const bob = await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: {
      id: 'user-bob',
      username: 'bob',
      password_hash: '$2b$10$dummyhashforbobbbbbb111111111111111111111111111',
    },
  });

  const carol = await prisma.user.upsert({
    where: { username: 'carol' },
    update: {},
    create: {
      id: 'user-carol',
      username: 'carol',
      password_hash: '$2b$10$dummyhashforcarolll111111111111111111111111111',
    },
  });

  // finished game: alice (white) beats bob with Scholar's Mate
  const scholarsMate = await prisma.game.upsert({
    where: { id: 'game-scholars-mate' },
    update: {},
    create: {
      id: 'game-scholars-mate',
      status: GameStatus.FINISHED,
      white_id: alice.id,
      black_id: bob.id,
      winner_id: alice.id,
      result: '1-0',
      fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
      pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0',
      turn: 'b',
      gamename: 'Scholars Mate demo',
      ended_at: new Date(),
    },
  });

  const moves = [
    { san: 'e4',    uci: 'e2e4', by_id: alice.id, fen_after: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
    { san: 'e5',    uci: 'e7e5', by_id: bob.id,   fen_after: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
    { san: 'Bc4',   uci: 'f1c4', by_id: alice.id, fen_after: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2' },
    { san: 'Nc6',   uci: 'b8c6', by_id: bob.id,   fen_after: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3' },
    { san: 'Qh5',   uci: 'd1h5', by_id: alice.id, fen_after: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3' },
    { san: 'Nf6',   uci: 'g8f6', by_id: bob.id,   fen_after: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4' },
    { san: 'Qxf7#', uci: 'h5f7', by_id: alice.id, fen_after: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4' },
  ];

  for (let i = 0; i < moves.length; i++) {
    await prisma.move.upsert({
      where: { game_id_ply: { game_id: scholarsMate.id, ply: i + 1 } },
      update: {},
      create: {
        id: `move-scholars-${i + 1}`,
        game_id: scholarsMate.id,
        ply: i + 1,
        ...moves[i],
      },
    });
  }

  // active game: bob (white) vs carol, one move in
  await prisma.game.upsert({
    where: { id: 'game-active' },
    update: {},
    create: {
      id: 'game-active',
      status: GameStatus.ACTIVE,
      white_id: bob.id,
      black_id: carol.id,
      fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      pgn: '1. d4',
      turn: 'b',
      gamename: 'bob vs carol',
    },
  });

  await prisma.move.upsert({
    where: { game_id_ply: { game_id: 'game-active', ply: 1 } },
    update: {},
    create: {
      id: 'move-active-1',
      game_id: 'game-active',
      ply: 1,
      san: 'd4',
      uci: 'd2d4',
      fen_after: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      by_id: bob.id,
    },
  });

  // waiting game: carol looking for an opponent
  await prisma.game.upsert({
    where: { id: 'game-waiting' },
    update: {},
    create: {
      id: 'game-waiting',
      status: GameStatus.WAITING,
      white_id: carol.id,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w',
      gamename: 'open lobby',
    },
  });

  console.log('Seeded: alice, bob, carol + 3 games + 8 moves');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

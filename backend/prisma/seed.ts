import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Ludo database...');

  // ── Create users ──────────────────────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'Alice',
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2', // password: "password"
      rating: 1200,
      highestRating: 1250,
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
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2',
      rating: 1100,
      highestRating: 1150,
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
      password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmOy1jOZ7jV5X7G6V6q2',
      rating: 1050,
      highestRating: 1100,
      avatarStyle: 'identicon',
      status: 'offline',
      isOnline: false,
      gamesWithThreePieces: 1,
    },
  });

  console.log(`  Created users: ${alice.username}, ${bob.username}, ${carol.username}`);

  // ── Create a finished Ludo game (Alice won with 4 pieces, Bob got 2) ────
  const finishedGame = await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      status: 'FINISHED',
      player1_id: alice.id,
      player2_id: bob.id,
      currentTurn: 'red',
      boardState: JSON.stringify({
        red: [{ progress: 57 }, { progress: 57 }, { progress: 57 }, { progress: 57 }],
        green: [{ progress: 52 }, { progress: 51 }, { progress: 50 }, { progress: 0 }],
      }),
      winner_id: alice.id,
      resultDetail: 'four_pieces',
      piecesInGoal_p1: 4,
      piecesInGoal_p2: 2,
      clashMode: false,
      mode: 'ranked',
      isRanked: true,
      isBot: false,
      moveCount: 120,
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(),
    },
  });

  // Create Ludo moves for the finished game
  for (let ply = 1; ply <= 120; ply++) {
    await prisma.move.create({
      data: {
        id: crypto.randomUUID(),
        game_id: finishedGame.id,
        ply,
        playerColor: ply % 2 === 1 ? 'red' : 'green',
        diceValue: ((ply * 7) % 6) + 1,
        pieceIndex: ply % 4,
        from: Math.min(ply * 2 - 2, 56),
        to: Math.min(ply * 2, 57),
        captured: ply === 30 || ply === 75,
        enteredHome: ply > 100,
        timestamp: new Date(Date.now() - 3600000 + ply * 30000),
      },
    });
  }

  console.log(`  Created finished game with ${finishedGame.moveCount} moves`);

  // ── Create an active Ludo game ──────────────────────────────────────────
  await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      status: 'ACTIVE',
      player1_id: bob.id,
      player2_id: carol.id,
      currentTurn: 'blue',
      boardState: JSON.stringify({
        red: [{ progress: 15 }, { progress: 0 }, { progress: 28 }, { progress: 0 }],
        green: [{ progress: 22 }, { progress: 10 }, { progress: 0 }, { progress: 0 }],
      }),
      diceValue: 4,
      consecutiveSixes: 0,
      clashMode: true,
      mode: 'casual',
      isRanked: false,
      isBot: false,
      moveCount: 45,
      startedAt: new Date(Date.now() - 1800000),
    },
  });

  console.log('  Created active game');

  // ── Create a waiting game (lobby) ───────────────────────────────────────
  await prisma.game.create({
    data: {
      id: crypto.randomUUID(),
      status: 'WAITING',
      player1_id: carol.id,
      boardState: JSON.stringify({ players: [], pieces: [] }),
      mode: 'ranked',
      isRanked: true,
      isBot: false,
      expires_at: new Date(Date.now() + 86400000),
      gamename: "Carol's Game",
    },
  });

  console.log('  Created waiting game (lobby)');
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
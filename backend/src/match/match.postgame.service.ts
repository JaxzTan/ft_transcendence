import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { secret } from '../secrets';
import Redis from 'ioredis';
import { LeaderboardRedisService } from '../leaderboard/leaderboard-redis.service';

const BOT_PREFIX = 'bot-';
const WIN_POINTS = 10;
const LOSS_POINTS = 5;

function isBotUserId(userId: string | undefined): boolean {
	return !!userId && userId.startsWith(BOT_PREFIX);
}

@Injectable()
export class MatchPostgameService {
	private redis: Redis;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly leaderboardRedis: LeaderboardRedisService,
	) {
		const host = process.env.REDIS_HOST || 'redis';
		const port = parseInt(process.env.REDIS_PORT || '6379', 10);
		const password = secret('REDIS_PASSWORD');
		this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
		this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
	}

	// Write final game results to Postgres and update player ratings.
	// Called by the game engine when a match ends. Creates game + participant rows,
	// updates ratings (points-based: +10 win / -5 loss), and pushes a leaderboard snapshot.
	async processGameEnd(data: { gameId: string; participants: Array<{ userId: string; color: string; rank: number; piecesCaptured?: number; piecesInGoal?: number }> }) {
		const { gameId, participants } = data;
		if (!gameId) throw new BadRequestException('gameId is required');
		if (!participants || !Array.isArray(participants) || participants.length < 2) {
			throw new BadRequestException('participants array is required (min 2)');
		}

		const existing = await this.prisma.db.game.findUnique({ where: { id: gameId } });
		if (existing) return { message: 'Game already processed', gameId };

		const matchData = await this.redis.hgetall(`match:${gameId}`);
		const startedAt = matchData?.startedAt ? parseInt(matchData.startedAt) : null;
		const endedAt = Date.now();
		const gameType = (matchData?.gameType as any) || 'PVP';
		const inviteCode = matchData?.inviteCode || null;

		await this.prisma.db.$transaction(async (tx) => {
			const game = await tx.game.create({
				data: {
					id: gameId,
					startedAt: new Date(startedAt || endedAt),
					endedAt: new Date(endedAt),
					status: 'COMPLETED',
					gameType,
					inviteCode,
				},
			});

			for (const p of participants) {
				await tx.gameParticipant.create({
					data: {
						id: crypto.randomUUID(),
						game_id: game.id,
						user_id: p.userId,
						color: p.color as any,
						rank: p.rank,
						piecesCaptured: p.piecesCaptured || 0,
						piecesInGoal: p.piecesInGoal || 0,
					},
				});

				// Points-based rating (no ELO). Bots are skipped.
				if (isBotUserId(p.userId)) continue;
				const isWinner = p.rank === 1;
				// Beating bots is worth HALF the points of beating humans: a PvE win
							// nets the winner ~50% of the normal PvP win reward (10 -> 5).
							const isBotGame = gameType === 'PVE';
							const winPoints = isBotGame ? Math.round(WIN_POINTS / 2) : WIN_POINTS;
							const ratingDelta = isWinner ? winPoints : -LOSS_POINTS;
				const user = await tx.user.findUnique({ where: { id: p.userId } });
				if (user) {
					const newRating = Math.max(0, user.rating + ratingDelta);
					await tx.user.update({
						where: { id: p.userId },
						data: {
							rating: newRating,
							highestRating: Math.max(user.highestRating, newRating),
							humanWins: isWinner ? { increment: 1 } : undefined,
							botWins: gameType === 'PVE' && isWinner ? { increment: 1 } : undefined,
							winStreak: isWinner ? { increment: 1 } : 0,
							bestWinStreak: isWinner ? Math.max(user.winStreak + 1, user.bestWinStreak) : undefined,
						},
					});
					try {
						await this.redis.zadd('leaderboard:global', newRating, p.userId);
					} catch { /* ignore */ }
				}
			}
		});

		// Push leaderboard snapshot to PostgreSQL after successful game end
		try {
			await this.leaderboardRedis.pushSnapshotToPostgres(this.prisma, 'global');
		} catch (err) {
			console.warn('Failed to push leaderboard snapshot:', err);
		}

		await this.redis.del(`match:${gameId}`);
		return { message: 'Game processed', gameId };
	}

	// Create a rematch from a completed game if at least 2 original players confirm.
	// Copies the original match's players into a new WAITING room with a fresh invite code.
	async rematch(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new BadRequestException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new BadRequestException('You are not a player in this game');

		const pendingKey = `rematch:${gameId}`;
		const pending = new Set<string>(JSON.parse(await this.redis.get(pendingKey) || '[]'));
		pending.add(userId);
		await this.redis.set(pendingKey, JSON.stringify(Array.from(pending)), 'EX', 86400);

		const originalPlayers = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean);
		const confirmedCount = originalPlayers.filter(p => pending.has(p)).length;

		if (confirmedCount < 2) {
			return { message: 'Waiting for more players', confirmed: confirmedCount, required: 2 };
		}

		const newGameId = crypto.randomUUID();
		await this.redis.hset(`match:${newGameId}`, {
			id: newGameId,
			status: 'WAITING',
			gameType: data.gameType || 'PVP',
			inviteCode: data.inviteCode || '',
			player1_id: data.player1_id,
			player2_id: data.player2_id || '',
			player3_id: data.player3_id || '',
			player4_id: data.player4_id || '',
			createdAt: Date.now().toString(),
		});
		await this.redis.expire(`match:${newGameId}`, 86400);
		await this.redis.del(pendingKey);

		const username = await this.prisma.db.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
		const token = this.jwt.sign(
			{ gameId: newGameId, playerId: userId, username: username?.username || undefined, displayName: username?.displayName ?? undefined, role: 'player1' },
			{ expiresIn: '24h' },
		);

		return { gameId: newGameId, token, engineUrl: 'ws://localhost:3001' };
	}

	// Remove stale match/rematch keys older than 24h from Redis.
	async cleanupStaleGames() {
		const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
		let cleaned = 0;

		let cursor = '0';
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				const createdAt = parseInt(data.createdAt || '0');
				if (createdAt > 0 && createdAt < oneDayAgo) {
					await this.redis.del(key);
					cleaned++;
				}
			}
		} while (cursor !== '0');

		let rematchCursor = '0';
		let rematchCleaned = 0;
		do {
			const [nextCursor, keys] = await this.redis.scan(rematchCursor, 'MATCH', 'rematch:*', 'COUNT', 100);
			rematchCursor = nextCursor;
			for (const key of keys) {
				await this.redis.del(key);
				rematchCleaned++;
			}
		} while (rematchCursor !== '0');

		return { matchesCleaned: cleaned, rematchKeysCleaned: rematchCleaned };
	}
}
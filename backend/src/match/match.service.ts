import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { LeaderboardRedisService } from '../leaderboard/leaderboard-redis.service';
import { secret } from '../secrets';
import Redis from 'ioredis';

const BOT_PREFIX = 'bot-';
const SLOT_COLORS = ['red', 'green', 'yellow', 'blue'];
function isBotUserId(userId: string | undefined): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}

// Points-based rating (no ELO matchmaking). Winner +10, loser -5.
const WIN_POINTS = 10;
const LOSS_POINTS = 5;

const FRONTEND_URL = secret('FRONTEND_URL') ?? 'https://localhost:8443';
export const ENGINE_WS_URL = FRONTEND_URL.replace(/^http/, 'ws');

function generateInviteCode(): string {
	// 6-char uppercase alphanumeric code (no I, O, 0, 1 to avoid confusion)
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

@Injectable()
export class MatchService {
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

	// ─── Unified Match Creation ───────────────────────────────────────────────
	/**
	 * Create a match in one of three modes:
	 * - 'pvp': Human vs human (2-4 players), status = WAITING, needs ready check
	 * - 'pve': Human vs bots (1 human + 1-3 bots), status = ACTIVE immediately
	 * - 'hotseat': Hot seat local multiplayer (2-4 humans), status = ACTIVE immediately
	 */
	async createMatch(
		userId: string,
		mode: 'pvp' | 'pve' | 'hotseat',
		playerCount: number,
		botCount: number,
		clashEnabled: boolean = true,
	) {
		if (playerCount < 2 || playerCount > 4) {
			throw new BadRequestException('Player count must be between 2 and 4');
		}
		if (botCount < 0 || botCount >= playerCount) {
			throw new BadRequestException('Bot count must be between 0 and playerCount - 1');
		}
		if (mode === 'pvp' && botCount > 0) {
			throw new BadRequestException('PvP mode cannot have bots');
		}
		if (mode === 'pve' && botCount === 0) {
			throw new BadRequestException('PvE mode must have at least 1 bot');
		}
		if (mode === 'hotseat' && botCount > 0) {
			throw new BadRequestException('Hot seat mode cannot have bots');
		}

		const gameId = crypto.randomUUID();
		const totalBots = botCount;
		const isPvP = mode === 'pvp';
		// Seat colors are assigned deterministically by slot (player1=red, player2=green, ...)
		// so every client can be told unambiguously which color it controls.
		const player1Color = SLOT_COLORS[0];

		const updates: Record<string, string> = {
			id: gameId,
			status: isPvP ? 'WAITING' : 'ACTIVE',
			gameType: mode.toUpperCase(),
			playerCount: playerCount.toString(),
			player1_id: userId,
			player1_color: player1Color,
			clashEnabled: clashEnabled.toString(),
			createdAt: Date.now().toString(),
		};

		if (isPvP) {
			// PvP: invite code for sharing
			updates.inviteCode = generateInviteCode();
		} else {
			// PvE or hotseat: started immediately, fill bot slots
			updates.startedAt = Date.now().toString();
			if (totalBots >= 1) updates.player2_id = BOT_PREFIX + SLOT_COLORS[1];
			if (totalBots >= 2) updates.player3_id = BOT_PREFIX + SLOT_COLORS[2];
			if (totalBots >= 3) updates.player4_id = BOT_PREFIX + SLOT_COLORS[3];
		}

		await this.redis.hset(`match:${gameId}`, updates);
		await this.redis.expire(`match:${gameId}`, 86400);

		const username = await this.resolveUsername(userId);
		const token = this.jwt.sign(
			{
				gameId,
				playerId: userId,
				username: username || undefined,
				role: 'player1',
				mode,
				clashEnabled,
				color: player1Color,
			},
			{ expiresIn: '24h' },
		);

		const result: any = { gameId, token, engineUrl: ENGINE_WS_URL, color: player1Color, mode, playerCount };
		if (isPvP) {
			result.inviteCode = updates.inviteCode;
		}
		return result;
	}

	// ─── Legacy Endpoints (kept for backward compatibility) ───────────────────
	async findRandomMatch(userId: string, clashEnabled: boolean = true) {
		// Scan Redis for a WAITING PvP game with an open slot
		let cursor = '0';
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				if (
					data.status === 'WAITING' &&
					data.gameType === 'PVP' &&
					data.player1_id !== userId &&
					!data.player2_id
				) {
					return this.joinMatch(data.id, userId);
				}
			}
		} while (cursor !== '0');
		return this.createMatch(userId, 'pvp', 4, 0, clashEnabled);
	}


	async createInvite(userId: string, clashEnabled: boolean = true) {
		const result = await this.createMatch(userId, 'pvp', 4, 0, clashEnabled);
		// createMatch returns inviteCode for PvP
		return result;
	}

	async playBot(userId: string, playerCount: number = 2, clashEnabled: boolean = true) {
		if (playerCount !== 2 && playerCount !== 4) {
			throw new BadRequestException('Player count must be 2 or 4');
		}
		const botCount = playerCount - 1;
		return this.createMatch(userId, 'pve', playerCount, botCount, clashEnabled);
	}

	// ─── PvP: Join by invite code ────────────────────────────────────────────
	async joinByInvite(inviteCode: string, userId: string) {
		let cursor = '0';
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				if (data.inviteCode === inviteCode && data.status === 'WAITING') {
					if (data.player1_id === userId) {
						throw new BadRequestException('You cannot join your own invite');
					}
					return this.joinMatch(data.id, userId);
				}
			}
		} while (cursor !== '0');
		throw new NotFoundException('Invite code not found or expired');
	}

	// ─── Internal: join an existing match by filling next slot ───────────────
	async joinMatch(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');
		if (data.status !== 'WAITING') throw new ForbiddenException('Game already started');

		const maxSeats = parseInt(data.playerCount || '4', 10);
		const occupiedIds = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean);
		if (occupiedIds.length >= maxSeats) throw new ForbiddenException('Room is full');

		const clashEnabled = data.clashEnabled === 'true';
		const slotIndex = !data.player2_id ? 1 : !data.player3_id ? 2 : 3;
		const slotKey = `player${slotIndex + 1}`;
		const assignedColor = SLOT_COLORS[slotIndex];

		// Stay in WAITING — players must click "ready" to start
		await this.redis.hset(`match:${gameId}`, `${slotKey}_id`, userId, `${slotKey}_color`, assignedColor);

		const players = [data.player1_id, userId, data.player3_id, data.player4_id].filter(Boolean);
		const playerCount = players.length;

		const username = await this.resolveUsername(userId);
		const token = this.jwt.sign(
			{ gameId, playerId: userId, username: username || undefined, role: 'player', clashEnabled, color: assignedColor },
			{ expiresIn: '24h' },
		);

		return { gameId, token, engineUrl: ENGINE_WS_URL, color: assignedColor, inviteCode: data.inviteCode || undefined };
	}

	// ─── Resolve a user's display username for embedding in match JWTs ───────
	// (ludo-engine has no DB access — it only knows what the token tells it)
	private async resolveUsername(userId: string): Promise<string | null> {
		if (isBotUserId(userId)) return null;
		const user = await this.prisma.db.user.findUnique({ where: { id: userId }, select: { username: true } });
		return user?.username ?? null;
	}

	// ─── Cancel / Abort ──────────────────────────────────────────────────────
	async cancelGame(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

		await this.redis.hset(`match:${gameId}`, 'status', 'ABORTED');
		await this.redis.expire(`match:${gameId}`, 3600);

		return { message: 'Game cancelled', gameId };
	}

	async resign(gameId: string, userId: string) {
		return this.cancelGame(gameId, userId);
	}

	// ─── Process Game End (writes to Postgres) ─────────────────────────────
	async processGameEnd(data: any) {
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
		const durationSeconds = startedAt ? Math.floor((endedAt - startedAt) / 1000) : 0;
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
						color: p.color,
						rank: p.rank,
						piecesCaptured: p.piecesCaptured || 0,
						piecesInGoal: p.piecesInGoal || 0,
					},
				});

				// Points-based rating (no ELO). Bots are skipped.
				if (isBotUserId(p.userId)) continue;
				const isWinner = p.rank === 1;
				const ratingDelta = isWinner ? WIN_POINTS : -LOSS_POINTS;
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

	// ─── Rematch (Redis-based) ──────────────────────────────────────────────
	async rematch(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

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

		const username = await this.resolveUsername(userId);
		const token = this.jwt.sign(
			{ gameId: newGameId, playerId: userId, username: username || undefined, role: 'player1' },
			{ expiresIn: '24h' },
		);

		return { gameId: newGameId, token, engineUrl: ENGINE_WS_URL };
	}

	// ─── List Active Games (from Redis) ─────────────────────────────────────
	async listActiveGames() {
		let cursor = '0';
		const games: any[] = [];
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				if (data.status === 'ACTIVE') {
					games.push({
						id: data.id,
						gameType: data.gameType,
						player1: data.player1_id,
						player2: data.player2_id,
					});
				}
			}
		} while (cursor !== '0');
		return games;
	}

	// ─── List Open Rooms (WAITING PvP games — joinable) ─────────────────────
	async listOpenRooms() {
		let cursor = '0';
		const rooms: Array<{ id: string; roomCode: string; hostId: string; seats: number; maxSeats: number }> = [];
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				if (data.status === 'WAITING' && data.gameType === 'PVP' && data.player1_id) {
					const seats = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean).length;
					rooms.push({
						id: data.id,
						roomCode: data.inviteCode,
						hostId: data.player1_id,
						seats,
						maxSeats: parseInt(data.playerCount || '4', 10),
					});
				}
			}
		} while (cursor !== '0');

		const hostIds = [...new Set(rooms.map((r) => r.hostId))];
		const hosts = await this.prisma.db.user.findMany({
			where: { id: { in: hostIds } },
			select: { id: true, username: true },
		});
		const usernames = new Map(hosts.map((u) => [u.id, u.username]));

		return rooms.map((r) => ({
			id: r.id,
			roomCode: r.roomCode,
			host: usernames.get(r.hostId) || 'Unknown',
			seats: r.seats,
			maxSeats: r.maxSeats,
			mode: r.maxSeats === 2 ? 'duel' : 'classic',
		}));
	}

	// ─── List My Rooms (WAITING or ACTIVE games I'm seated in) ──────────────
	// Distinct from listOpenRooms: this is a private "find my way back in" list
	// (survives closing the tab — sessionStorage's activeMatch doesn't), not the
	// public browse-any-room list.
	async listMyRooms(userId: string) {
		let cursor = '0';
		const rooms: Array<{ id: string; roomCode: string | null; status: string; gameType: string; seats: number; maxSeats: number }> = [];
		do {
			const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*', 'COUNT', 100);
			cursor = nextCursor;
			for (const key of keys) {
				const data = await this.redis.hgetall(key);
				const seatIds = [data.player1_id, data.player2_id, data.player3_id, data.player4_id];
				if (!seatIds.includes(userId)) continue;
				if (data.status !== 'WAITING' && data.status !== 'ACTIVE') continue;
				rooms.push({
					id: data.id,
					roomCode: data.inviteCode || null,
					status: data.status,
					gameType: data.gameType,
					seats: seatIds.filter(Boolean).length,
					maxSeats: parseInt(data.playerCount || '4', 10),
				});
			}
		} while (cursor !== '0');
		return rooms;
	}

	// ─── Rejoin a room I'm already seated in (fresh token, no new slot) ─────
	async rejoin(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const slotIndex = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].indexOf(userId);
		if (slotIndex === -1) throw new ForbiddenException('You are not a player in this game');

		const color = (data[`player${slotIndex + 1}_color`] as string) || SLOT_COLORS[slotIndex];
		const clashEnabled = data.clashEnabled === 'true';
		const username = await this.resolveUsername(userId);
		const token = this.jwt.sign(
			{
				gameId,
				playerId: userId,
				username: username || undefined,
				role: slotIndex === 0 ? 'player1' : 'player',
				clashEnabled,
				color,
			},
			{ expiresIn: '24h' },
		);

		return { gameId, token, engineUrl: ENGINE_WS_URL, color, inviteCode: data.inviteCode || undefined };
	}

	// ─── Spectate ───────────────────────────────────────────────────────────
	async spectate(gameId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');
		if (data.status !== 'ACTIVE') throw new ForbiddenException('Game is not active');

		const token = this.jwt.sign(
			{ gameId, playerId: null, role: 'spectator' },
			{ expiresIn: '24h' },
		);

		return { gameId, token, engineUrl: ENGINE_WS_URL };
	}

	// ─── Ready Game ─────────────────────────────────────────────────────────
	async readyGame(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

		return { message: 'Player ready', gameId };
	}

	// ─── Exit Game ──────────────────────────────────────────────────────────
	async exitGame(gameId: string, userId: string) {
		return { message: 'Exited game', gameId };
	}

	async gameEnd(gameId: string, userId: string) {
		return { message: 'Game end acknowledged', gameId };
	}

	// ─── Cleanup Stale Games (Redis) ─────────────────────────────────────────
	async cleanupStaleGames() {
		const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
		let cleaned = 0;

		// Scan match keys non-blocking
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

		// Clean rematch keys
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

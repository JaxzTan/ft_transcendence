import { Injectable } from '@nestjs/common';
import { MatchCreatorService } from './match.creator.service';
export { ENGINE_WS_URL } from './match.creator.service';
import { MatchPlayerService } from './match.player.service';
import { MatchQueryService } from './match.query.service';
import { MatchPostgameService } from './match.postgame.service';

@Injectable()
export class MatchService {
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
		// playerCount === 1 is the solo "Test Your Luck" run — hotseat with
		// nobody else seated, just the host racing their own dice.
		if (playerCount < 1 || playerCount > 4) {
			throw new BadRequestException('Player count must be between 1 and 4');
		}
		if (playerCount === 1 && mode !== 'hotseat') {
			throw new BadRequestException('Solo play requires hotseat mode');
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
		if (mode === 'pvp' && playerCount < 2) {
			throw new BadRequestException('PvP mode requires at least 2 players');
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

	// ─── Creation ───────────────────────────────────────────────────────────
	async createMatch(userId: string, mode: 'pvp' | 'pve' | 'hotseat', playerCount: number, botCount: number, clashEnabled: boolean = true) {
		return this.creator.createMatch(userId, mode, playerCount, botCount, clashEnabled);
	}
	async findRandomMatch(userId: string, clashEnabled: boolean = true) {
		return this.creator.findRandomMatch(userId, clashEnabled, (gameId: string, uid: string) => this.player.joinMatch(gameId, uid), (uid: string) => this.query.listMyRooms(uid));
	}
	async createInvite(userId: string, clashEnabled: boolean = true) {
		return this.creator.createInvite(userId, clashEnabled);
	}
	async playBot(userId: string, playerCount: number = 2, clashEnabled: boolean = true) {
		return this.creator.playBot(userId, playerCount, clashEnabled);
	}
	async joinByInvite(inviteCode: string, userId: string) {
		return this.creator.joinByInvite(inviteCode, userId, (gameId: string, uid: string) => this.player.joinMatch(gameId, uid));
	}

	// ─── Joining ───────────────────────────────────────────────────────────
	async joinMatch(gameId: string, userId: string) {
		return this.player.joinMatch(gameId, userId);
	}
	async rejoin(gameId: string, userId: string) {
		return this.player.rejoin(gameId, userId);
	}

	// ─── Mark Started (called by ludo-engine once a PvP game actually starts) ─
	// listOpenRooms only ever shows WAITING rooms — without this, a match stays
	// WAITING in Redis forever after the ready-check flips it active in the
	// engine, so it keeps showing up as "open" even mid-game.
	async markStarted(gameId: string) {
		const exists = await this.redis.exists(`match:${gameId}`);
		if (!exists) return { message: 'Game not found', gameId };

		await this.redis.hset(`match:${gameId}`, 'status', 'ACTIVE');
		await this.redis.hsetnx(`match:${gameId}`, 'startedAt', Date.now().toString());
		return { message: 'Game marked active', gameId };
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

	// ─── State transitions ─────────────────────────────────────────────────
	async readyGame(gameId: string, userId: string) {
		return this.player.readyGame(gameId, userId);
	}
	async exitGame(gameId: string, userId: string) {
		return this.player.exitGame(gameId, userId);
	}
	async gameEnd(gameId: string, userId: string) {
		return this.player.gameEnd(gameId, userId);
	}
	async cancelGame(gameId: string, userId: string) {
		return this.player.cancelGame(gameId, userId);
	}
	async resign(gameId: string, userId: string) {
		return this.player.resign(gameId, userId);
	}

	// ─── Queries ───────────────────────────────────────────────────────────
	async listActiveGames() {
		return this.query.listActiveGames();
	}
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
					const maxSeats = parseInt(data.playerCount || '4', 10);
					// Full rooms aren't "open" — hide them instead of listing an
					// unjoinable row (join would just 403 with "Room is full").
					if (seats >= maxSeats) continue;
					rooms.push({
						id: data.id,
						roomCode: data.inviteCode,
						hostId: data.player1_id,
						seats,
						maxSeats,
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
	async listMyRooms(userId: string) {
		return this.query.listMyRooms(userId);
	}

	// ─── Post-game ─────────────────────────────────────────────────────────
	async processGameEnd(data: any) {
		return this.postgame.processGameEnd(data);
	}
	async rematch(gameId: string, userId: string) {
		return this.postgame.rematch(gameId, userId);
	}
	async cleanupStaleGames() {
		return this.postgame.cleanupStaleGames();
	}
}
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { secret } from '../secrets';
import Redis from 'ioredis';

const BOT_PREFIX = 'bot-';
const SLOT_COLORS = ['blue', 'red', 'green', 'yellow'];
function isBotUserId(userId: string | undefined): boolean {
	return !!userId && userId.startsWith(BOT_PREFIX);
}

@Injectable()
export class MatchPlayerService {
	private redis: Redis;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
	) {
		const host = process.env.REDIS_HOST || 'redis';
		const port = parseInt(process.env.REDIS_PORT || '6379', 10);
		const password = secret('REDIS_PASSWORD');
		this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
		this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
	}

	// Join an existing WAITING match by filling the next empty slot.
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

		await this.redis.hset(`match:${gameId}`, `${slotKey}_id`, userId, `${slotKey}_color`, assignedColor);

		const username = await this.resolveUsername(userId);
		const token = this.jwt.sign(
			{ gameId, playerId: userId, username: username || undefined, role: 'player', clashEnabled, color: assignedColor },
			{ expiresIn: '24h' },
		);

		return { gameId, token, engineUrl: 'ws://localhost:3001', color: assignedColor, inviteCode: data.inviteCode || undefined, mode: data.gameType ? data.gameType.toLowerCase() : 'pvp', playerCount: parseInt(data.playerCount || '2', 10) };
	}

	// Rejoin a match the user is already seated in (fresh token, no new slot).
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

		return { gameId, token, engineUrl: 'ws://localhost:3001', color, inviteCode: data.inviteCode || undefined, mode: data.gameType ? data.gameType.toLowerCase() : 'pvp', playerCount: parseInt(data.playerCount || '2', 10) };
	}

	// Generate a spectator token for an ACTIVE match.
	async spectate(gameId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');
		if (data.status !== 'ACTIVE') throw new ForbiddenException('Game is not active');

		const token = this.jwt.sign(
			{ gameId, playerId: null, role: 'spectator' },
			{ expiresIn: '24h' },
		);

		return { gameId, token, engineUrl: 'ws://localhost:3001' };
	}

	// Toggle the ready flag for a player in a WAITING match.
	async readyGame(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

		const readyKey = `ready:${gameId}`;
		const current = new Set<string>(JSON.parse(await this.redis.get(readyKey) || '[]'));
		if (current.has(userId)) {
			current.delete(userId);
		} else {
			current.add(userId);
		}
		await this.redis.set(readyKey, JSON.stringify(Array.from(current)), 'EX', 86400);

		const readyCount = current.size;
		const totalPlayers = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean).length;

		return {
			message: 'Player ready',
			gameId,
			readyCount,
			totalPlayers,
			allReady: readyCount === totalPlayers,
		};
	}

	// Remove a player from a match room and clear their ready state.
	async exitGame(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

		const slotMap: Record<string, string> = {
			[data.player1_id]: 'player1_id',
			[data.player2_id || '']: 'player2_id',
			[data.player3_id || '']: 'player3_id',
			[data.player4_id || '']: 'player4_id',
		};
		const slotKey = slotMap[userId];
		if (slotKey) {
			await this.redis.hdel(`match:${gameId}`, slotKey, `${slotKey.replace('_id', '_color')}`);
		}

		const readyKey = `ready:${gameId}`;
		const current = new Set<string>(JSON.parse(await this.redis.get(readyKey) || '[]'));
		current.delete(userId);
		await this.redis.set(readyKey, JSON.stringify(Array.from(current)), 'EX', 86400);

		return { message: 'Exited game', gameId };
	}

	// Cancel (abort) a match, setting its status to ABORTED.
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

	// Alias for cancelGame — player resigns from the match.
	async resign(gameId: string, userId: string) {
		return this.cancelGame(gameId, userId);
	}

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

	// Mark a match as ENDED (called when the game is finished).
	async gameEnd(gameId: string, userId: string) {
		const data = await this.redis.hgetall(`match:${gameId}`);
		if (!data || !data.id) throw new NotFoundException('Game not found');

		const isPlayer = data.player1_id === userId || data.player2_id === userId ||
			data.player3_id === userId || data.player4_id === userId;
		if (!isPlayer) throw new ForbiddenException('You are not a player in this game');

		await this.redis.hset(`match:${gameId}`, 'status', 'ENDED');
		await this.redis.expire(`match:${gameId}`, 3600);

		return { message: 'Game ended', gameId };
	}

	private async resolveUsername(userId: string): Promise<string | null> {
		if (isBotUserId(userId)) return null;
		const user = await this.prisma.db.user.findUnique({ where: { id: userId }, select: { username: true } });
		return user?.username ?? null;
	}
}
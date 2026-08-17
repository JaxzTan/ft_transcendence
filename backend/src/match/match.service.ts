import { Injectable } from '@nestjs/common';
import { MatchCreatorService } from './match.creator.service';
export { ENGINE_WS_URL } from './match.creator.service';
import { MatchPlayerService } from './match.player.service';
import { MatchQueryService } from './match.query.service';
import { MatchPostgameService } from './match.postgame.service';

@Injectable()
export class MatchService {
	constructor(
		private readonly creator: MatchCreatorService,
		private readonly player: MatchPlayerService,
		private readonly query: MatchQueryService,
		private readonly postgame: MatchPostgameService,
	) {}

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
	async spectate(gameId: string) {
		return this.player.spectate(gameId);
	}

	// ─── Mark Started (called by ludo-engine once a PvP game actually starts) ─
	async markStarted(gameId: string) {
		return this.player.markStarted(gameId);
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
		return this.query.listOpenRooms();
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

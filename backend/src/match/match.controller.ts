import { Controller, Post, UseGuards, Request, Body, Param, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { MatchService, ENGINE_WS_URL } from './match.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { requireSecret } from '../secrets';

@Controller()
export class MatchController {
	constructor(private readonly match: MatchService, private readonly jwt: JwtService) { }

	// ─── PvP: Create invite game (share code via chat) ────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/match/pvp/invite')
	pvpInvite(
		@Request() req: { user: { id: string } },
		@Body('clashEnabled') clashEnabled?: boolean,
	) {
		return this.match.createInvite(req.user.id, clashEnabled);
	}

	// ─── PvP: Join by invite code ────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/match/join/:code')
	joinInvite(
		@Request() req: { user: { id: string } },
		@Param('code') code: string,
	) {
		return this.match.joinByInvite(code, req.user.id);
	}

	// ─── PvE: Human vs Bot (2p or 4p) ────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/match/pve')
	pve(
		@Request() req: { user: { id: string } },
		@Body('playerCount') playerCount: number,
		@Body('clashEnabled') clashEnabled?: boolean,
	) {
		return this.match.playBot(req.user.id, playerCount || 2, clashEnabled);
	}

	// ─── Unified Match Creation ────────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/match/create')
	create(
		@Request() req: { user: { id: string } },
		@Body('mode') mode: 'pvp' | 'pve' | 'hotseat',
		@Body('playerCount') playerCount: number,
		@Body('botCount') botCount: number,
		@Body('clashEnabled') clashEnabled?: boolean,
	) {
		return this.match.createMatch(
			req.user.id,
			mode || 'pve',
			playerCount || 2,
			botCount || 0,
			clashEnabled,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Post('api/match/rematch/:gameId')
	rematch(@Request() req: { user: { id: string } }, @Param('gameId') gameId: string) {
		return this.match.rematch(gameId, req.user.id);
	}

	// ─── Game Actions ───────────────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/game/:id/ready')
	ready(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		return this.match.readyGame(gameId, req.user.id);
	}

	@UseGuards(JwtAuthGuard)
	@Post('api/game/:id/resign')
	resign(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		return this.match.resign(gameId, req.user.id);
	}

	// ─── Browse Games ───────────────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Get('api/games/active')
	listActive() {
		return this.match.listActiveGames();
	}

	// ─── Browse Open Rooms (WAITING PvP games — joinable) ──────────────────
	@UseGuards(JwtAuthGuard)
	@Get('api/games/rooms')
	listRooms() {
		return this.match.listOpenRooms();
	}

	// ─── My Rooms (WAITING/ACTIVE games I'm seated in — rejoin after refresh) ─
	@UseGuards(JwtAuthGuard)
	@Get('api/games/mine')
	listMine(@Request() req: { user: { id: string } }) {
		return this.match.listMyRooms(req.user.id);
	}

	@UseGuards(JwtAuthGuard)
	@Post('api/game/:id/rejoin')
	rejoin(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		return this.match.rejoin(gameId, req.user.id);
	}

	@UseGuards(JwtAuthGuard)
	@Post('api/games/:id/spectate')
	spectate(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		const token = this.jwt.sign(
			{ gameId, playerId: null, role: 'spectator' },
			{ expiresIn: '24h' },
		);
		return { gameId, token, engineUrl: ENGINE_WS_URL };
	}

	// ─── Game End (called by ludo-engine) ──────────────────────────────────
	@Post('api/game/end')
	gameEnd(@Headers('x-engine-key') key: string, @Body() body: any) {
		if (key !== requireSecret('ENGINE_API_KEY')) {
			throw new UnauthorizedException('Invalid engine key');
		}
		return this.match.processGameEnd(body);
	}

	// ─── Game Started (called by ludo-engine once the ready-check passes) ───
	@Post('api/game/:id/started')
	gameStarted(@Headers('x-engine-key') key: string, @Param('id') gameId: string) {
		if (key !== requireSecret('ENGINE_API_KEY')) {
			throw new UnauthorizedException('Invalid engine key');
		}
		return this.match.markStarted(gameId);
	}

	// ─── Exit Game (player acknowledges leaving) ────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/game/:id/exit')
	exitGame(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		return this.match.exitGame(gameId, req.user.id);
	}

	// ─── Cleanup ─────────────────────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/match/cleanup')
	cleanup() {
		return this.match.cleanupStaleGames();
	}

	// ─── Abort Game ──────────────────────────────────────────────────────────
	@UseGuards(JwtAuthGuard)
	@Post('api/game/:id/abort')
	abort(@Request() req: { user: { id: string } }, @Param('id') gameId: string) {
		return this.match.cancelGame(gameId, req.user.id);
	}
}
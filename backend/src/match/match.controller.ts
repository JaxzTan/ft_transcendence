import { Controller, Post, UseGuards, Request, Body, Param, Get } from '@nestjs/common';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Controller()
export class MatchController {
  constructor(private readonly match: MatchService, private readonly jwt: JwtService) {}

  // ─── PvP: Random auto-matchmaking ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/match/pvp/random')
  pvpRandom(@Request() req: { user: { sub: string } }) {
    return this.match.findRandomMatch(req.user.sub);
  }

  // ─── PvP: Create invite game (share code via chat) ────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/match/pvp/invite')
  pvpInvite(@Request() req: { user: { sub: string } }) {
    return this.match.createInvite(req.user.sub);
  }

  // ─── PvP: Join by invite code ────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/match/join/:code')
  joinInvite(@Request() req: { user: { sub: string } }, @Param('code') code: string) {
    return this.match.joinByInvite(code, req.user.sub);
  }

  // ─── PvE: Human vs Bot (2p or 4p) ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/match/pve')
  pve(
    @Request() req: { user: { sub: string } },
    @Body('playerCount') playerCount: number,
  ) {
    return this.match.playBot(req.user.sub, playerCount || 2);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api/match/rematch/:gameId')
  rematch(@Request() req: { user: { sub: string } }, @Param('gameId') gameId: string) {
    return this.match.rematch(gameId, req.user.sub);
  }

  // ─── Game Actions ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/game/:id/resign')
  resign(@Request() req: { user: { sub: string } }, @Param('id') gameId: string) {
    return this.match.resign(gameId, req.user.sub);
  }

  // ─── Browse Games ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('api/games/active')
  listActive() {
    return this.match.listActiveGames();
  }

  @UseGuards(JwtAuthGuard)
  @Post('api/games/:id/spectate')
  spectate(@Request() req: { user: { sub: string } }, @Param('id') gameId: string) {
    const token = this.jwt.sign(
      { gameId, playerId: null, role: 'spectator' },
      { expiresIn: '24h' },
    );
    return { gameId, token, engineUrl: 'ws://ludo-engine:3001' };
  }

  // ─── Game End (called by ludo-engine) ──────────────────────────────────
  @Post('api/game/end')
  gameEnd(@Body() body: any) {
    return this.match.processGameEnd(body);
  }

  // ─── Exit Game (player acknowledges leaving) ────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/game/:id/exit')
  exitGame(@Request() req: { user: { sub: string } }, @Param('id') gameId: string) {
    return this.match.exitGame(gameId, req.user.sub);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/match/cleanup')
  cleanup() {
    return this.match.cleanupOldMoves();
  }

  // ─── Abort Game ──────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('api/game/:id/abort')
  abort(@Request() req: { user: { sub: string } }, @Param('id') gameId: string) {
    return this.match.cancelGame(gameId, req.user.sub);
  }
}
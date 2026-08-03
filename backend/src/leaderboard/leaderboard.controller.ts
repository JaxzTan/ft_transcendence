import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  async getLeaderboard(
    @Request() req: any,
    @Query('mode') mode?: 'global' | 'ranked' | 'casual' | 'bot',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req as any).user?.sub || null;
    return this.leaderboard.getLeaderboard({
      mode: mode || 'global',
      page: parseInt(page || '1', 10),
      limit: Math.min(parseInt(limit || '20', 10), 100),
      userId: userId || undefined,
    });
  }
}
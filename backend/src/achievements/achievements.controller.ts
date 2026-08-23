import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /**
   * GET /api/achievements — registry-driven report.
   * Returns { [achKey]: { unlocked, progress, target } } for all 15 keys.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAchievements(@Request() req: { user: { id: string } }) {
    const achievements = await this.achievements.getUserAchievements(req.user.id);
    return achievements || {};
  }

  /**
   * POST /api/achievements/check — force re-evaluate achievements for current user.
   * Silent backfill: announce=false so no notification burst fires.
   * Returns { unlocked: string[] } (keys).
   */
  @UseGuards(JwtAuthGuard)
  @Post('check')
  async checkAchievements(@Request() req: { user: { id: string } }) {
    return this.achievements.evaluateForUser(req.user.id, undefined, false);
  }
}
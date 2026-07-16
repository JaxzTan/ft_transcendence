import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /**
   * GET /api/achievements — returns all 16 achievement booleans for the current user
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAchievements(@Request() req: { user: { sub: string } }) {
    const achievements = await this.achievements.getUserAchievements(req.user.sub);
    return achievements || {};
  }

  /**
   * POST /api/achievements/check — force re-evaluate achievements for current user
   */
  @UseGuards(JwtAuthGuard)
  @Post('check')
  async checkAchievements(@Request() req: { user: { sub: string } }) {
    return this.achievements.evaluateForUser(req.user.sub);
  }
}
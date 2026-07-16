import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getStats(@Request() req: { user: { sub: string } }) {
    return this.stats.getStats(req.user.sub);
  }
}
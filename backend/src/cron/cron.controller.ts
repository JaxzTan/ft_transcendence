import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { CronService } from './cron.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/cron')
export class CronController {
  constructor(private readonly cron: CronService) {}

  @UseGuards(JwtAuthGuard)
  @Post('cleanup')
  async cleanup() {
    return this.cron.cleanupOldMoves();
  }
}

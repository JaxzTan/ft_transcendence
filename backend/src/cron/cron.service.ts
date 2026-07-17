import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  // ─── Daily stale game cleanup ──────────────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { timeZone: 'Asia/Kuala_Lumpur' })
  async runDailyCron() {
    this.logger.log('Starting daily cleanup...');
    // Match cleanup is handled by Redis TTL expiration (24h on match: keys)
    this.logger.log('Cleanup complete (Redis TTL handles expired matches)');
  }

  async onModuleInit() {
    this.logger.log('CronService initialized');
  }

  /**
   * Manual cleanup trigger (also runs daily via @Cron).
   * Match keys expire automatically via Redis TTL; this just logs the sweep.
   * Heavy cleanup (Redis match keys) is done by MatchService.cleanupOldMoves().
   */
  async cleanupOldMoves() {
    this.logger.log('Manual cleanup triggered (Redis TTL handles expired match keys)');
    return { message: 'Cleanup complete', matchesCleaned: 0, rematchKeysCleaned: 0 };
  }
}
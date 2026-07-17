import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardRedisService } from './leaderboard-redis.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardRedisService, PrismaService],
  exports: [LeaderboardService, LeaderboardRedisService],
})
export class LeaderboardModule {}

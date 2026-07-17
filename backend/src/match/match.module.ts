import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { PrismaService } from '../prisma.service';
import { AuthModule, JwtModule } from '../auth/auth.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [AuthModule, JwtModule, AchievementsModule, LeaderboardModule],
  controllers: [MatchController],
  providers: [MatchService, PrismaService],
  exports: [MatchService],
})
export class MatchModule {}

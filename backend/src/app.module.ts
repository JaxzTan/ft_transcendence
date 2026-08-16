import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FriendsModule } from './friends/friends.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AchievementsModule } from './achievements/achievements.module';
import { StatsModule } from './player-stats/stats.module';
import { MatchModule } from './match/match.module';
import { PresenceModule } from './presence/presence.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    FriendsModule,
    LeaderboardModule,
    AchievementsModule,
    StatsModule,
    MatchModule,
    PresenceModule,
    NotificationModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}

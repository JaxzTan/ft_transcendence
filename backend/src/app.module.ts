import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
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
  providers: [
    PrismaService,
    // APP_GUARD applies the guard to every route. It has to be registered as a
    // provider rather than via app.useGlobalGuards() so Nest's DI container can
    // construct it — ThrottlerGuard needs its storage and options injected.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService],
})
export class AppModule {}

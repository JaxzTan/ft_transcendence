import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService],
  // Exported so other modules (FriendsModule, MatchModule, AchievementsModule)
  // can inject NotificationService and call notify() without duplicating it.
  exports: [NotificationService],
})
export class NotificationModule {}

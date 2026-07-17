import { Module } from '@nestjs/common';
import { MatchModule } from '../match/match.module';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

@Module({
  imports: [MatchModule],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}

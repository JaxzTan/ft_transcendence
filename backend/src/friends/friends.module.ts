import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [FriendsController],
  providers: [FriendsService, PrismaService],
  exports: [FriendsService],
})
export class FriendsModule {}
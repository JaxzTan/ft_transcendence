import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ReconnectService } from './reconnect.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, ReconnectService, PrismaService],
  exports: [UserService, ReconnectService],
})
export class UserModule {}

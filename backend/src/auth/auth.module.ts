import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma.service';
import * as fs from 'fs';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secretPath = process.env.JWT_SECRET_FILE || '/secrets/ludo_engine_credentials.txt';
        let secret: string;
        try {
          secret = fs.readFileSync(secretPath, 'utf8').trim();
        } catch {
          secret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
        }
        return {
          secret,
          signOptions: { expiresIn: '48h' },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        // Development: relaxed for testing, Production: strict for security
        limit: process.env.NODE_ENV === 'production' ? 5 : 60, // 5/min prod, 60/min dev
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

// Re-export JwtModule for use in other modules
export { JwtModule } from '@nestjs/jwt';

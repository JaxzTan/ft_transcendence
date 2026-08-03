import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { GithubStrategy } from './github.strategy';
import { FortyTwoStrategy } from './fortytwo.strategy';
import { MailService } from './mail.service';
import { TwoFactorService } from './twofactor.service';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma.service';
import { requireSecret } from '../secrets';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireSecret('JWT_SECRET'),
      // Access tokens are now short-lived; the refresh token (SessionService)
      // keeps the user signed in for 7 days by minting new access tokens.
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    TwoFactorService,
    SessionService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    FortyTwoStrategy,
    PrismaService,
  ],
  // Re-exported so feature modules (e.g. MatchModule) get the *configured*
  // JwtModule rather than registering a second, secret-less instance.
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}

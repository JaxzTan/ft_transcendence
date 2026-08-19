import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';
import { MailService } from './mail.service';
import { TwoFactorService } from './twofactor.service';
import { SessionService } from './session.service';
import { secret } from '../secrets';

const SALT_ROUNDS = 10;
// Also where the SPA lives; /api on the same origin reaches the backend
// through whichever proxy (nginx or Vite) is serving it.
const BASE_URL = secret('FRONTEND_URL') ?? 'https://localhost:8443';

// store all email as lowercase since email is case-insensitive
const normalizeEmail = (email: string) => email.trim().toLowerCase();

// convert at read/display time
const formatVerifiedAt = (date: Date) =>
  new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);

// login()'s two outcomes, depending on the user's 2FA preference. The explicit
// union lets the controller narrow on `twoFactorRequired` cleanly.
type LoginResult =
  | { twoFactorRequired: true; pendingToken: string }
  | {
      twoFactorRequired: false;
      accessToken: string;
      refreshToken: string;
      user: { id: string; username: string };
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
    private readonly session: SessionService,
  ) {}

  async register(dto: RegisterDto, baseUrl: string = BASE_URL) {
    const existing = await this.prisma.db.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const email = dto.email ? normalizeEmail(dto.email) : dto.email;
    if (email) {
      const emailTaken = await this.prisma.db.user.findUnique({ where: { email } });
      if (emailTaken) {
        throw new ConflictException('Email is already registered');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.db.user.create({
      data: {
        id: crypto.randomUUID(),
        username: dto.username,
        email,
        password_hash: passwordHash,
      },
    });

    // No session yet, the account activates via the emailed link.
    const token = await this.twoFactor.createVerifyToken(user.id);
    await this.mail.sendVerification(
      user.email!,
      `${baseUrl}/api/auth/verify-email?token=${token}`,
    );
    return { message: 'Account created — check your email to verify your address.' };
  }

  /* Redeems a signup verification link. Returns false for unknown/expired tokens. */
  async verifyEmail(token: string): Promise<boolean> {
    const userId = await this.twoFactor.consumeVerifyToken(token);
    if (!userId) return false;
    const user = await this.prisma.db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    console.log(`Email verified for ${user.username} at ${formatVerifiedAt(user.emailVerified!)}`);
    return true;
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    // Accept either a username or an email in the same field.
    const user = await this.prisma.db.user.findFirst({
      where: {
        OR: [
          { username: dto.identifier },
          { email: normalizeEmail(dto.identifier) },
        ],
      },
    });
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid username, email, or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username, email, or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified — open the link we sent you first');
    }

    // 2FA off → password alone is enough; issue the session immediately.
    // 2FA on → password is only factor one; email a code and finish later.
    if (!user.twoFactorEnabled) {
      return { twoFactorRequired: false as const, ...(await this.issueSession(user.id, user.username)) };
    }
    const { pendingToken } = await this.startTwoFactor(user.id, user.email!);
    return { twoFactorRequired: true as const, pendingToken };
  }

  /*
   * Step one of reset: email a one-time link if the address belongs to a local
   * (password) account. The return value is intentionally the same in every
   * case — unknown email, OAuth-only account, or success — so a caller can't
   * use this endpoint to discover which emails are registered.
   */
  async forgotPassword(rawEmail: string, baseUrl: string = BASE_URL) {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.db.user.findUnique({ where: { email } });
    // Only local accounts have a password to reset; OAuth-only users (no
    // password_hash) sign in through their provider instead.
    if (user?.password_hash) {
      const token = await this.twoFactor.createResetToken(user.id);
      await this.mail.sendPasswordReset(email, `${baseUrl}/reset-password?token=${token}`);
    }
    return { message: 'If that email is registered, a reset link is on its way.' };
  }

  /* Step two: redeem the link's token and set the new password. */
  async resetPassword(token: string, newPassword: string) {
    const userId = await this.twoFactor.consumeResetToken(token);
    if (!userId) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
        // Redeeming an emailed link proves inbox control — the same guarantee
        // signup verification gives — so confirm the address if it wasn't yet.
        // Without this, an unverified user could reset yet still be login-blocked.
        emailVerified: new Date(),
      },
    });
    // drop every existing session after a password reset
    await this.session.revokeAll(userId);
    return { message: 'Password updated — you can log in with it now.' };
  }

  /* Factor two: email a one-time code, hand back the challenge reference. */
  async startTwoFactor(userId: string, email: string) {
    const { pendingToken, code } = await this.twoFactor.startChallenge(userId);
    await this.mail.send2faCode(email, code);
    return { pending: true as const, pendingToken };
  }

  async completeTwoFactor(pendingToken: string, code: string) {
    const userId = await this.twoFactor.verifyChallenge(pendingToken, code);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    return this.issueSession(user.id, user.username);
  }

  /** Sign a short-lived access-token JWT (15m, per JwtModule config). */
  signAccess(userId: string, username: string): string {
    const payload: JwtPayload = { sub: userId, username };
    return this.jwt.sign(payload);
  }

  /**
   * Issue a fresh session: a short-lived access token plus a long-lived,
   * revocable refresh token. Called once both login factors pass (password
   * login and OAuth both funnel through completeTwoFactor).
   */
  async issueSession(userId: string, username: string) {
    const accessToken = this.signAccess(userId, username);
    const refreshToken = await this.session.issue(userId);
    return { accessToken, refreshToken, user: { id: userId, username } };
  }

  /**
   * Trade a valid refresh token for a new access token, rotating the refresh
   * token in the same step. Throws 401 when it's missing/expired/revoked — the
   * frontend reads that as "session over, log in again".
   */
  async refresh(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('Not authenticated');
    const rotated = await this.session.rotate(refreshToken);
    if (!rotated) throw new UnauthorizedException('Session expired — please log in again');
    const user = await this.prisma.db.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new UnauthorizedException('Session expired — please log in again');
    return {
      accessToken: this.signAccess(user.id, user.username),
      refreshToken: rotated.newToken,
      user: { id: user.id, username: user.username },
    };
  }

  /** Revoke the given refresh token — logout on this device. */
  async logout(refreshToken?: string) {
    if (refreshToken) await this.session.revoke(refreshToken);
  }

  /** Read the user's current 2FA preference. */
  async getTwoFactorSetting(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { twoFactorEnabled: user.twoFactorEnabled };
  }

  /** Turn email-code 2FA on or off for the user. */
  async setTwoFactorSetting(userId: string, enabled: boolean) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
    return { twoFactorEnabled: enabled };
  }

  /**
   * Called after a provider (Google/GitHub) has verified the user.
   * Finds the matching user, or links/creates one, then returns it.
   */
  async validateOAuthLogin(input: {
    provider: string;
    providerAccountId: string;
    email?: string;
    usernameSeed: string;
  }) {
    // If provider account exist just log them in
    const existingAccount = await this.prisma.db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (existingAccount) {
      return existingAccount.user;
    }

    //  If first time with this provider, and email matches an existing
    //  user, link to that user.
    const email = input.email ? normalizeEmail(input.email) : undefined;
    let user = email
      ? await this.prisma.db.user.findUnique({ where: { email } })
      : null;

    // Create new
    if (!user) {
      const username = await this.generateUniqueUsername(input.usernameSeed);
      user = await this.prisma.db.user.create({
        data: {
          id: crypto.randomUUID(),
          username,
          email,
          emailVerified: email ? new Date() : null,
        },
      });
    }

    await this.prisma.db.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    });

    return user;
  }

  // Turning usernames into unique seeds
  private async generateUniqueUsername(seed: string) {
    const base = seed.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
    let candidate = base;
    while (await this.prisma.db.user.findUnique({ where: { username: candidate } })) {
      candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return candidate;
  }
}

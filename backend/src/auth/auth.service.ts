import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';
import { MailService } from './mail.service';
import { TwoFactorService } from './twofactor.service';
import { secret } from '../secrets';

const SALT_ROUNDS = 10;
// Also where the SPA lives; /api on the same origin reaches the backend
// through whichever proxy (nginx or Vite) is serving it.
const BASE_URL = secret('FRONTEND_URL') ?? 'https://localhost:8443';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    if (dto.email) {
      const emailTaken = await this.prisma.db.user.findUnique({ where: { email: dto.email } });
      if (emailTaken) {
        throw new ConflictException('Email is already registered');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.db.user.create({
      data: {
        id: crypto.randomUUID(),
        username: dto.username,
        email: dto.email,
        password_hash: passwordHash,
      },
    });

    // No session yet — the account activates via the emailed link.
    const token = await this.twoFactor.createVerifyToken(user.id);
    await this.mail.sendVerification(
      user.email!,
      `${BASE_URL}/api/auth/verify-email?token=${token}`,
    );
    return { message: 'Account created — check your email to verify your address.' };
  }

  /** Redeems a signup verification link. Returns false for unknown/expired tokens. */
  async verifyEmail(token: string): Promise<boolean> {
    const userId = await this.twoFactor.consumeVerifyToken(token);
    if (!userId) return false;
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    return true;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({ where: { username: dto.username } });
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified — open the link we sent you first');
    }

    // Password is only factor one; the session is issued by completeTwoFactor.
    return this.startTwoFactor(user.id, user.email!);
  }

  /** Factor two: email a one-time code, hand back the challenge reference. */
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
    return this.issueToken(user.id, user.username);
  }

  issueToken(userId: string, username: string) {
    const payload: JwtPayload = { sub: userId, username };
    const token = this.jwt.sign(payload);
    return { token, user: { id: userId, username } };
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
    let user = input.email
      ? await this.prisma.db.user.findUnique({ where: { email: input.email } })
      : null;

    // Create new
    if (!user) {
      const username = await this.generateUniqueUsername(input.usernameSeed);
      user = await this.prisma.db.user.create({
        data: {
          id: crypto.randomUUID(),
          username,
          email: input.email,
          emailVerified: input.email ? new Date() : null,
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

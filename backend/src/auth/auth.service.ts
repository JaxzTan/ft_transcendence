import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username is already taken');
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

    return this.issueToken(user.id, user.username);
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
    displayName?: string;
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
          displayName: input.displayName,
          emailVerified: input.email ? new Date() : null, // provider already verified it
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

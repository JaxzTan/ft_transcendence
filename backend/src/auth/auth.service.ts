import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(username: string, password: string, avatarStyle?: string) {
    const existing = await this.prisma.db.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException('Username taken');
    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.db.user.create({
      data: {
        id: crypto.randomUUID(),
        username,
        password_hash: hash,
        avatarStyle: avatarStyle || 'bottts',
      },
    });
    return { id: user.id, username: user.username };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.db.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // Update login tracking
    const now = new Date();
    const lastLogin = user.lastLoginAt;
    let loginStreak = user.loginStreak;
    let daysActive = user.daysActive;

    if (lastLogin) {
      const lastLoginDate = new Date(lastLogin);
      const diffDays = Math.floor((now.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        loginStreak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        loginStreak = 1;
      }
      // diffDays === 0: same day, no change

      // Check if today is a new active day
      const todayStr = now.toISOString().split('T')[0];
      const lastLoginStr = lastLoginDate.toISOString().split('T')[0];
      if (todayStr !== lastLoginStr) {
        daysActive += 1;
      }
    } else {
      // First login ever
      loginStreak = 1;
      daysActive = 1;
    }

    await this.prisma.db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        loginStreak,
        daysActive,
      },
    });

    const token = this.jwt.sign({ sub: user.id, username: user.username });
    return { token, user: { id: user.id, username: user.username } };
  }

  async getUser(userId: string) {
    return this.prisma.db.user.findUnique({ where: { id: userId } });
  }

  async updateAvatarStyle(userId: string, avatarStyle: string) {
    const allowedStyles = ['bottts', 'adventurer', 'pixelArt', 'funEmoji'];
    if (!allowedStyles.includes(avatarStyle)) {
      throw new BadRequestException(`Invalid avatar style. Allowed: ${allowedStyles.join(', ')}`);
    }

    const user = await this.prisma.db.user.update({
      where: { id: userId },
      data: { avatarStyle },
      select: { id: true, username: true, avatarStyle: true },
    });

    return user;
  }
}

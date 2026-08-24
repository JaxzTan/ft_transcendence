import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PresenceService } from '../presence/presence.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  async getPublicProfile(username: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        createdAt: true,
        achievement: {
          select: {
            avatarStyle: true,
            rating: true,
            highestRating: true,
            wins: true,
            losses: true,
            winStreak: true,
            bestWinStreak: true,
            botWins: true,
            humanWins: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    const { achievement, ...rest } = user;
    const status = await this.presence.getStatus(user.id);
    return { ...rest, ...achievement, status };
  }

  async uploadAvatar(userId: string, data: Buffer, contentType: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Prisma 7 uses Bytes type for avatarPhoto
    await this.prisma.db.achievement.update({
      where: { userId },
      data: { avatarPhoto: data as any, avatarPhotoContentType: contentType },
    });

    return { message: 'Avatar uploaded', contentType };
  }

  async getAvatar(username: string): Promise<{ data: Buffer; contentType: string } | null> {
    const user = await this.prisma.db.user.findUnique({
      where: { username },
      select: { achievement: { select: { avatarPhoto: true, avatarPhotoContentType: true } } },
    });
    if (!user || !user.achievement.avatarPhoto || !user.achievement.avatarPhotoContentType) return null;
    return { data: Buffer.from(user.achievement.avatarPhoto), contentType: user.achievement.avatarPhotoContentType };
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.db.achievement.update({
      where: { userId },
      data: { avatarPhoto: null, avatarPhotoContentType: null },
    });

    return { message: 'Avatar deleted' };
  }

  async getUserGames(username: string, page: number = 1, limit: number = 20) {
    const user = await this.prisma.db.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException(`User "${username}" not found`);

    const skip = (page - 1) * limit;

    const [participations, total] = await Promise.all([
      this.prisma.db.gameParticipant.findMany({
        where: { user_id: user.id },
        orderBy: { game: { endedAt: 'desc' } },
        skip,
        take: limit,
        include: {
          game: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      username: true,
                      displayName: true,
                      achievement: { select: { avatarStyle: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.db.gameParticipant.count({ where: { user_id: user.id } }),
    ]);

    return {
      games: participations.map((p) => ({
        gameId: p.game_id,
        status: p.game.status,
        color: p.color,
        rank: p.rank,
        piecesCaptured: p.piecesCaptured,
        piecesInGoal: p.piecesInGoal,
        startedAt: p.game.startedAt,
        endedAt: p.game.endedAt,
        participants: p.game.participants.map((gp) => ({
          username: gp.user.username,
          displayName: gp.user.displayName,
          avatarStyle: gp.user.achievement.avatarStyle,
          color: gp.color,
          rank: gp.rank,
          piecesInGoal: gp.piecesInGoal,
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
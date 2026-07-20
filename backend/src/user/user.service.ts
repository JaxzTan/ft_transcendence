import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(username: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatarStyle: true,
        rating: true,
        highestRating: true,
        rankedWins: true,
        rankedLosses: true,
        rankedDraws: true,
        winStreak: true,
        bestWinStreak: true,
        botWins: true,
        humanWins: true,
        totalPlayTimeMs: true,
        daysActive: true,
        loginStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    return user;
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
                include: { user: { select: { username: true, avatarStyle: true } } },
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
        totalTurns: p.totalTurns,
        piecesCaptured: p.piecesCaptured,
        piecesInGoal: p.piecesInGoal,
        durationSeconds: p.game.durationSeconds,
        startedAt: p.game.startedAt,
        endedAt: p.game.endedAt,
        participants: p.game.participants.map((gp) => ({
          username: gp.user.username,
          avatarStyle: gp.user.avatarStyle,
          color: gp.color,
          rank: gp.rank,
          piecesInGoal: gp.piecesInGoal,
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
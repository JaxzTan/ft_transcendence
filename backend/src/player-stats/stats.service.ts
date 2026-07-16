import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { error: 'User not found' };
    }

    const participations = await this.prisma.db.gameParticipant.findMany({
      where: { user_id: userId },
    });

    const totalGames = participations.length;
    const wins = participations.filter((p) => p.rank === 1).length;
    const totalTurns = participations.reduce((s, p) => s + p.totalTurns, 0);
    const totalCaptures = participations.reduce((s, p) => s + p.piecesCaptured, 0);
    const totalPiecesInGoal = participations.reduce((s, p) => s + p.piecesInGoal, 0);

    return {
      totalGames,
      wins,
      losses: totalGames - wins,
      totalTurns,
      totalCaptures,
      totalPiecesInGoal,
      avgTurnsPerGame: totalGames > 0 ? Math.round(totalTurns / totalGames) : 0,
      avgCapturesPerGame: totalGames > 0 ? Math.round(totalCaptures / totalGames * 10) / 10 : 0,
    };
  }
}
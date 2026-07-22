import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateAfterGame(gameId: string): Promise<void> {
    const game = await this.prisma.db.game.findUnique({
      where: { id: gameId },
      include: { participants: true },
    });
    if (!game) return;

    // Evaluate all participants
    for (const p of game.participants) {
      await this.evaluateForUser(p.user_id, game);
    }
  }

  async evaluateForUser(userId: string, game?: any): Promise<{ unlocked: string[] }> {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) return { unlocked: [] };

    const unlocked: string[] = [];
    const currentGame = game || (await this.prisma.db.game.findFirst({
      where: { participants: { some: { user_id: userId } } },
      orderBy: { endedAt: 'desc' },
      include: { participants: true },
    }));

    if (!currentGame) return { unlocked: [] };

    // Get this participant's record
    const myParticipation = currentGame.participants?.find((p: any) => p.user_id === userId);
    const myRank = myParticipation?.rank || 0;
    const myPiecesInGoal = myParticipation?.piecesInGoal || 0;
    const won = myRank === 1;

    // Get opponent participants
    const opponents = currentGame.participants?.filter((p: any) => p.user_id !== userId) || [];
    const isRanked = false; // Game model no longer stores ranked — same for all participants

    // Populate user stat counters by scanning all participations
    const allParticipations = await this.prisma.db.gameParticipant.findMany({
      where: { user_id: userId },
    });

    const totalGames = allParticipations.length;
    const wins = allParticipations.filter((p: any) => p.rank === 1).length;
    const botGames = allParticipations.filter((p: any) => p.user_id === 'ludo-bot').length; // approximation
    const humanWins = wins; // simplified — all wins count

    // achFirstBlood — First win
    if (!user.achFirstBlood && wins >= 1) {
      await this.unlock(userId, 'achFirstBlood');
      unlocked.push('First Blood');
    }

    // achOnFire — 3 consecutive wins (tracked via winStreak on User)
    if (!user.achOnFire && user.winStreak >= 3 && wins >= 3) {
      await this.unlock(userId, 'achOnFire');
      unlocked.push('On Fire');
    }

    // achDiceMaster — 50 wins
    if (!user.achDiceMaster && wins >= 50) {
      await this.unlock(userId, 'achDiceMaster');
      unlocked.push('Dice Master');
    }

    // achBabySteps — Win 1st game vs bots
    if (!user.achBabySteps && wins >= 1 && botGames >= 1) {
      await this.unlock(userId, 'achBabySteps');
      unlocked.push('Baby Steps');
    }

    // achTheDiceLoveMe — Win 10 games vs bots
    if (!user.achTheDiceLoveMe && wins >= 10 && botGames >= 10) {
      await this.unlock(userId, 'achTheDiceLoveMe');
      unlocked.push('The Dice Love Me');
    }

    // achTactician — Win 100 games
    if (!user.achTactician && wins >= 100) {
      await this.unlock(userId, 'achTactician');
      unlocked.push('Tactician');
    }

    // achMaster — Win 250 games
    if (!user.achMaster && wins >= 250) {
      await this.unlock(userId, 'achMaster');
      unlocked.push('Master');
    }

    // achGrandBotMaster — Win 500 games
    if (!user.achGrandBotMaster && wins >= 500) {
      await this.unlock(userId, 'achGrandBotMaster');
      unlocked.push('Grand Bot Master');
    }

    // achWorldChampion — Win 1000 games
    if (!user.achWorldChampion && wins >= 1000) {
      await this.unlock(userId, 'achWorldChampion');
      unlocked.push('World Champion');
    }

    // achLoveTheMachine — 100 games played
    if (!user.achLoveTheMachine && totalGames >= 100) {
      await this.unlock(userId, 'achLoveTheMachine');
      unlocked.push('Love The Machine');
    }

    // achft_Transcendence — 100 wins vs humans
    if (!user.achft_Transcendence && humanWins >= 100) {
      await this.unlock(userId, 'achft_Transcendence');
      unlocked.push('FT Transcendence');
    }

    // achSpeedDemon — Win in under 30 minutes (calculated from game duration)
    if (won && currentGame.startedAt && currentGame.endedAt) {
      const gameDurationMs = new Date(currentGame.endedAt).getTime() - new Date(currentGame.startedAt).getTime();
      if (gameDurationMs < 30 * 60 * 1000) {
        await this.unlock(userId, 'achSpeedDemon');
        unlocked.push('Speed Demon');
      }
    }
    // achUnstoppable — Capture 3 pieces in a single game
    if (!user.achUnstoppable && (myParticipation?.piecesCaptured || 0) >= 3) {
      await this.unlock(userId, 'achUnstoppable');
      unlocked.push('Unstoppable');
    }

    // achCleanSweep — Win with 4 pieces and all opponents have 0
    if (!user.achCleanSweep && won && myPiecesInGoal === 4) {
      const allOpponentsZero = opponents.every((o: any) => o.piecesInGoal === 0);
      if (allOpponentsZero) {
        await this.unlock(userId, 'achCleanSweep');
        unlocked.push('Clean Sweep');
      }
    }

    // achLastLaugh — Win while all opponents have >=1 piece in goal
    if (!user.achLastLaugh && won && myPiecesInGoal === 4) {
      const allOpponentsHavePieces = opponents.length > 0 && opponents.every((o: any) => o.piecesInGoal >= 1);
      if (allOpponentsHavePieces) {
        await this.unlock(userId, 'achLastLaugh');
        unlocked.push('Last Laugh');
      }
    }

    return { unlocked };
  }

  async getUserAchievements(userId: string) {
    return this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        achFirstBlood: true,
        achOnFire: true,
        achDiceMaster: true,
        achBabySteps: true,
        achTheDiceLoveMe: true,
        achTactician: true,
        achMaster: true,
        achGrandBotMaster: true,
        achWorldChampion: true,
        achLoveTheMachine: true,
        achft_Transcendence: true,
        achUnstoppable: true,
        achCleanSweep: true,
        achLastLaugh: true,
      },
    });
  }

  private async unlock(userId: string, field: string): Promise<void> {
    try {
      await this.prisma.db.user.update({
        where: { id: userId },
        data: { [field]: true },
      });
      this.logger.log(`Achievement unlocked for user ${userId}: ${field}`);
    } catch (error) {
      this.logger.error(`Failed to unlock achievement ${field} for user ${userId}`, error);
    }
  }
}
import { GameState, MoveResult, PlayerColor } from './types';
import { MoveValidator } from './move-validator';
import { advanceTurnInState } from './player-handler';

/**
 * Apply a completed move's outcome: sync piece fields, bump the move counter,
 * run the win check, update stats/bonus, advance the turn (or re-roll on
 * 6/capture), and clear pending move data.
 *
 * Shared by movePiece and clash resolution (attackerWon=false → repulse:
 * the attacker forfeits the round, no bonus, turn always advances). Pure
 * mutation — recordMove / saveGameState / emit stay with the caller.
 * Returns the winner if the game just finished.
 */
export function applyMoveOutcome(
  state: GameState,
  result: MoveResult,
  diceValue: number,
  attackerWon: boolean,
): PlayerColor | null {
  // Sync frontend-compatible piece fields.
  const movedPiece = state.pieces.find(p => p.id === result.pieceId);
  if (movedPiece) {
    movedPiece.isInGoal = result.to === 57;
    movedPiece.isInBase = result.to <= 0;
  }
  if (result.captured && result.capturedPieceIds) {
    for (const id of result.capturedPieceIds) {
      const capturedPiece = state.pieces.find(p => p.id === id);
      if (capturedPiece) {
        capturedPiece.isInGoal = false;
        capturedPiece.isInBase = true;
      }
    }
  }

  state.moveCounter++;

  const winner = MoveValidator.checkWinner(state);
  if (winner) {
    const piecesInGoal = MoveValidator.countPiecesInGoal(state, winner);
    const winnerPlayer = state.players.find(p => p.color === winner);
    if (winnerPlayer) {
      winnerPlayer.stats.piecesInGoal = piecesInGoal;
      winnerPlayer.piecesInGoal = piecesInGoal;
      winnerPlayer.isFinished = true;
      winnerPlayer.finishedAt = new Date().toISOString();
    }
    state.status = 'finished';
    state.winner = winner;
    state.resultDetail = 'four_pieces';
  } else {
    // Sync piecesInGoal for the moving player.
    const mover = state.players.find(p => p.color === result.color);
    const sixBonus = diceValue === 6;
    if (mover) {
      mover.piecesInGoal = MoveValidator.countPiecesInGoal(state, result.color);
      mover.hasRolled = false;
      if (attackerWon) {
        mover.bonusRoll = sixBonus || result.captured;
      } else {
        // Repulse: the attacker forfeits the round — no bonus even on a 6.
        mover.bonusRoll = false;
      }
    }
    // 6/capture → same player rolls again; otherwise advance (repulse always advances).
    if (!attackerWon) {
      state.turnPhase = 'WAITING_FOR_ROLL';
      advanceTurnInState(state);
    } else if (sixBonus || result.captured) {
      state.turnPhase = 'WAITING_FOR_ROLL';
    } else {
      state.turnPhase = 'WAITING_FOR_ROLL';
      advanceTurnInState(state);
    }
  }

  // Clear pending moves and dice value after the move is processed.
  state.pendingLegalMoves = [];
  state.pendingDiceValue = undefined;
  state.pendingIsFirstRoll = undefined;

  return winner;
}

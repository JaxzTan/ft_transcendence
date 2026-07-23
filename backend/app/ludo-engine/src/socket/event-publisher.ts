import { RedisGameStore } from '../redis';
import { GameEvent } from '../types';

/**
 * EventPublisher handles the single source of truth for game lifecycle events.
 * Each engine event is published to Redis pub/sub so all connected clients
 * receive state updates.
 */
export class EventPublisher {
  constructor(private store: RedisGameStore) {}

  /**
   * Publish an engine event to Redis pub/sub for broadcast to all clients
   * in the game room (via the Redis subscriber in server.ts).
   */
  publish(event: GameEvent): void {
    const { gameId } = event;

    switch (event.type) {
      case 'dice_rolled':
        this.store.publish(gameId, JSON.stringify({
          type: 'dice_rolled',
          value: event.value,
          legalMoves: event.legalMoves,
          bonusRoll: event.bonusRoll,
        }));
        break;

      case 'piece_moved':
        this.store.publish(gameId, JSON.stringify({
          type: 'piece_moved',
          ...event.result,
        }));
        break;

      case 'game_ended':
        this.store.publish(gameId, JSON.stringify({
          type: 'game_ended',
          winner: event.winner,
          resultDetail: event.resultDetail,
        }));
        break;

      case 'player_exited':
        this.store.publish(gameId, JSON.stringify({
          type: 'player_exited',
          color: event.color,
        }));
        break;

      case 'clash_start':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_start',
          key: event.key,
          target: event.target,
          duration: event.duration,
          attacker: event.attacker,
          defender: event.defender,
        }));
        break;

      case 'clash_frozen':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_frozen',
          reason: event.reason,
          disconnectedPlayer: event.disconnectedPlayer,
          reconnectDeadline: event.reconnectDeadline,
        }));
        break;

      case 'clash_result':
        this.store.publish(gameId, JSON.stringify({
          type: 'clash_result',
          winner: event.winner,
          loser: event.loser,
          winnerPresses: event.winnerPresses,
          loserPresses: event.loserPresses,
        }));
        break;
    }
  }
}
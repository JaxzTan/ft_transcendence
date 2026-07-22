import { RedisGameStore } from './redis';
import { EventPublisher } from './socket/event-publisher';
import type { PlayerColor, ClashState, GameEvent } from './types';

const ATTACKER_KEYS = ['U','I','O','H','J','K','B','N','M'];
const CLASH_DURATION = 5000; //5 seconds
const RECONNECT_WINDOW = 30000; // 30 seconds to reconnect before forfeit

function randomTarget(): number {
  return Math.floor(Math.random() * 16) + 35; // 35-50
}

export class ClashManager {
  private store: RedisGameStore;
  private publisher: EventPublisher;

  constructor(store: RedisGameStore, publisher: EventPublisher) {
    this.store = store;
    this.publisher = publisher;
  }

  async startClash(gameId: string, attacker: PlayerColor, defender: PlayerColor): Promise<void> {
    const key = ATTACKER_KEYS[Math.floor(Math.random() * ATTACKER_KEYS.length)];
    const target = randomTarget();
    const clashState: ClashState = {
      attacker,
      defender,
      attackerKey: key,
      defenderKey: key,
      target,
      duration: CLASH_DURATION / 1000,
      startedAt: Date.now(),
      attackerPresses: 0,
      defenderPresses: 0
    };
    await this.store.saveClashState(gameId, clashState);
    this.publisher.publish({
      type: 'clash_start',
      gameId,
      key,
      target,
      duration: CLASH_DURATION / 1000,
      attacker,
      defender
    });
  }

  /**
   * Freeze the clash due to player disconnect.
   * Does NOT schedule a timeout — the caller (player-handler) owns the unified disconnect timeout.
   */
  async freezeClash(gameId: string, color: PlayerColor): Promise<void> {
    const clash = await this.store.loadClashState(gameId);
    if (!clash) return;

    clash.disconnectTimestamp = Date.now();
    clash.reconnectDeadline = Date.now() + RECONNECT_WINDOW;
    clash.waitingForReconnect = color;
    await this.store.saveClashState(gameId, clash);

    this.publisher.publish({
      type: 'clash_frozen',
      gameId,
      reason: 'player_disconnected',
      disconnectedPlayer: color,
      reconnectDeadline: clash.reconnectDeadline
    });
  }

  async handleReconnect(gameId: string, color: PlayerColor): Promise<void> {
    const clash = await this.store.loadClashState(gameId);
    if (!clash) return;

    // Check if reconnect is within the window
    if (clash.reconnectDeadline && Date.now() <= clash.reconnectDeadline) {
      // Player reconnected in time - clear disconnect state
      delete clash.disconnectTimestamp;
      delete clash.reconnectDeadline;
      delete clash.waitingForReconnect;
      await this.store.saveClashState(gameId, clash);
    } else {
      // Too late - player forfeits the clash
      // This should have been handled by the timeout, but as a safety net
      console.warn(`Player ${color} attempted late reconnect in clash for game ${gameId}`);
    }
  }

  /**
   * Record a key press for the clash minigame.
   * Validates that the provided key matches the player's assigned key.
   */
  async recordPress(gameId: string, color: PlayerColor, key: string): Promise<boolean> {
    const clash = await this.store.loadClashState(gameId);
    if (!clash) return false;

    // Validate key matches the player's assigned key
    const expectedKey = color === clash.attacker ? clash.attackerKey : clash.defenderKey;
    if (key !== expectedKey) {
      return false; // Invalid key, ignore the press
    }

    // Don't allow presses if player is disconnected and past deadline
    if (clash.waitingForReconnect && clash.reconnectDeadline && Date.now() > clash.reconnectDeadline) {
      return false;
    }

    const elapsed = Date.now() - clash.startedAt;
    if (elapsed > CLASH_DURATION) return false;

    const count = await this.store.recordClashPress(gameId, color);
    return count > 0;
  }

  /**
   * Resolve a clash with a winner and loser.
   * Publishes the clash_result event and clears the clash state.
   */
  async resolveClash(gameId: string, winner: PlayerColor, loser: PlayerColor): Promise<void> {
    const clash = await this.store.loadClashState(gameId);
    if (!clash) return;

    this.publisher.publish({
      type: 'clash_result',
      gameId,
      winner,
      loser,
      winnerPresses: winner === clash.attacker ? clash.attackerPresses : clash.defenderPresses,
      loserPresses: loser === clash.attacker ? clash.attackerPresses : clash.defenderPresses
    });

    await this.store.clearClashState(gameId);
  }
}
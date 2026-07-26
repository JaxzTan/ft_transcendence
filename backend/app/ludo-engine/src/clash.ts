import { RedisGameStore } from './redis';
import { EventPublisher } from './socket/event-publisher';
import type { PlayerColor, ClashState, GameEvent } from './types';

const ATTACKER_KEYS = ['u','i','o','h','j','k','b','n','m'];
const DEFENDER_KEYS = ['q','w','e','a','s','d','z','x','c'];
const CLASH_DURATION = 5000; //5 seconds
const CLASH_TARGET = 42;
const RECONNECT_WINDOW = 30000; // 30 seconds to reconnect before forfeit

export class ClashManager {
  private store: RedisGameStore;
  private publisher: EventPublisher;

  constructor(store: RedisGameStore, publisher: EventPublisher) {
    this.store = store;
    this.publisher = publisher;
  }

  async startClash(gameId: string, attacker: PlayerColor, defender: PlayerColor): Promise<void> {
    const attackerKey = ATTACKER_KEYS[Math.floor(Math.random() * ATTACKER_KEYS.length)];
    const defenderKey = DEFENDER_KEYS[Math.floor(Math.random() * DEFENDER_KEYS.length)];
    const clashState: ClashState = {
      attacker,
      defender,
      attackerKey,
      defenderKey,
      target: CLASH_TARGET,
      duration: CLASH_DURATION / 1000,
      startedAt: Date.now(),
      attackerPresses: 0,
      defenderPresses: 0
    };
    await this.store.saveClashState(gameId, clashState);
    this.publisher.publish({
      type: 'clash_start',
      gameId,
      attackerKey,
      defenderKey,
      target: CLASH_TARGET,
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
    if (count >= CLASH_TARGET) {
      // Early win! This player hit the target score — resolve immediately
      const winner = color;
      const loser = color === clash.attacker ? clash.defender : clash.attacker;
      await this.resolveClash(gameId, winner, loser);
      return true;
    }
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
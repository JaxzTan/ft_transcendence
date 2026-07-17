import { RedisGameStore } from './redis';
import type { PlayerColor, ClashState } from './types';

const ATTACKER_KEYS = ['U','I','O','H','J','K','B','N','M'];
const CLASH_DURATION = 5000;
const RECONNECT_WINDOW = 30000;

function randomTarget(): number {
  return Math.floor(Math.random() * 16) + 35; // 35-50
}

export class ClashManager {
  private store: RedisGameStore;

  constructor(store: RedisGameStore) {
    this.store = store;
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
    await this.store.publish(gameId, JSON.stringify({
      type: 'clash_start',
      key,
      target,
      duration: CLASH_DURATION / 1000,
      attacker,
      defender
    }));
  }

  async handleDisconnect(gameId: string, color: PlayerColor): Promise<{ winner: PlayerColor; loser: PlayerColor } | null> {
    const clash = await this.store.loadClashState(gameId);
    if (!clash) return null;

    // Store disconnect info in Redis for persistence
    clash.disconnectTimestamp = Date.now();
    clash.reconnectDeadline = Date.now() + RECONNECT_WINDOW;
    clash.waitingForReconnect = color;
    await this.store.saveClashState(gameId, clash);

    await this.store.publish(gameId, JSON.stringify({
      type: 'clash_frozen',
      reason: 'player_disconnected',
      disconnectedPlayer: color,
      reconnectDeadline: clash.reconnectDeadline
    }));

    // Schedule auto-forfeit when reconnect window expires
    setTimeout(async () => {
      const currentClash = await this.store.loadClashState(gameId);
      if (!currentClash) return;
      
      // Only forfeit if still waiting for reconnect and deadline has passed
      if (currentClash.waitingForReconnect && 
          currentClash.reconnectDeadline && 
          Date.now() >= currentClash.reconnectDeadline) {
        const loser = currentClash.waitingForReconnect;
        const winner = currentClash.attacker === loser 
          ? currentClash.defender 
          : currentClash.attacker;
        
        await this.resolveClash(gameId, winner, loser);
      }
    }, RECONNECT_WINDOW + 1000);

    return null;
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

    await this.store.publish(gameId, JSON.stringify({
      type: 'clash_result',
      winner,
      loser,
      winnerPresses: winner === clash.attacker ? clash.attackerPresses : clash.defenderPresses,
      loserPresses: loser === clash.attacker ? clash.attackerPresses : clash.defenderPresses
    }));

    await this.store.clearClashState(gameId);
  }
}
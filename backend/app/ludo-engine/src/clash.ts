import { RedisGameStore } from './redis';
import type { PlayerColor } from './types';

const ATTACKER_KEYS = ['U','I','O','H','J','K','B','N','M'];
const DEFENDER_KEYS = ['Q','W','E','A','S','D','Z','X','C'];
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

  async startClash(gameId: string, attacker: PlayerColor, defender: PlayerColor) {
    const key = ATTACKER_KEYS[Math.floor(Math.random() * ATTACKER_KEYS.length)];
    const target = randomTarget();
    await this.store.initClash(gameId, {
      attacker, defender,
      attackerKey: key,
      defenderKey: key,
      target,
      duration: CLASH_DURATION / 1000,
      startedAt: Date.now()
    });
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
    const data = await (this.store as any)['client'].hgetall((this.store as any)['clashKey'](gameId));
    if (!data || !data.attacker) return null;

    await (this.store as any)['client'].hset((this.store as any)['clashKey'](gameId), {
      [`${color}_disconnected`]: Date.now().toString(),
      [`${color}_reconnect_deadline`]: (Date.now() + RECONNECT_WINDOW).toString()
    });

    await this.store.publish(gameId, JSON.stringify({
      type: 'clash_frozen',
      reason: 'player_disconnected',
      disconnectedPlayer: color,
      reconnectDeadline: Date.now() + RECONNECT_WINDOW
    }));

    const attacker = data.attacker as PlayerColor;
    const defender = data.defender as PlayerColor;
    const opponent = color === attacker ? defender : attacker;

    setTimeout(async () => {
      const updated = await (this.store as any)['client'].hgetall((this.store as any)['clashKey'](gameId));
      const stillDisconnected = updated[`${color}_disconnected`];
      if (stillDisconnected) {
        await this.store.publish(gameId, JSON.stringify({
          type: 'clash_result',
          winner: opponent,
          loser: color,
          winnerPresses: parseInt(updated[`${opponent}Presses`] || '0'),
          loserPresses: parseInt(updated[`${color}Presses`] || '0'),
          reason: 'opponent_timeout'
        }));
      }
    }, RECONNECT_WINDOW);

    return null;
  }

  async recordPress(gameId: string, color: PlayerColor): Promise<boolean> {
    const data = await (this.store as any)['client'].hgetall((this.store as any)['clashKey'](gameId));
    if (!data || !data.attacker) return false;

    const startedAt = parseInt(data.startedAt);
    const elapsed = Date.now() - startedAt;
    if (elapsed > CLASH_DURATION) return false;

    if (data.attacker_disconnected || data.defender_disconnected) {
      const disconnected = data.attacker_disconnected ? (data.attacker as PlayerColor) : (data.defender as PlayerColor);
      if (color === disconnected) return false;
    }

    const field = color === (data.attacker as string) ? 'attackerPresses' : 'defenderPresses';
    await (this.store as any)['client'].hincrby((this.store as any)['clashKey'](gameId), field, 1);
    return true;
  }
}
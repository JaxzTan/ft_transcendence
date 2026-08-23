import { RedisGameStore } from './redis';
import { EventPublisher } from './socket/event-publisher';
import type { PlayerColor, ClashState } from './types';

export const ATTACKER_KEYS = ['u', 'i', 'o', 'h', 'j', 'k', 'b', 'n', 'm'];
export const DEFENDER_KEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
export const CLASH_ANNOUNCE_MS = 1500; // big "CLASH!" flash
export const CLASH_COUNTDOWN_MS = 3000; // 3-2-1, keys hidden
export const CLASH_PRESS_MS = 5000; // press race
export const CLASH_RESULT_MS = 2000; // result card (client-displayed)
/** Total server-side freeze after a clash resolves — must be LONGER than the
 *  client's CLASH_RESULT_MS card (covers the 3s card + network + animation
 *  slack) so no move/roll can land while the victory card is still visible.
 *  Tweak THIS to control "how long nothing can act after a clash ends". */
export const CLASH_RESULT_FREEZE_MS = 4000;
export const CLASH_SWEEP_GRACE_MS = 15000; // outer cleanup bound from clash start
export const CLASH_TARGET = 42;
export const CLASH_PRESS_CAP_MS = 70; // min ms between accepted presses per side

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
		const startedAt = Date.now();
		const clashState: ClashState = {
			attacker,
			defender,
			attackerKey,
			defenderKey,
			target: CLASH_TARGET,
			duration: CLASH_PRESS_MS / 1000,
			startedAt,
			announceDeadline: startedAt + CLASH_ANNOUNCE_MS,
			countdownDeadline: startedAt + CLASH_ANNOUNCE_MS + CLASH_COUNTDOWN_MS,
			pressDeadline: startedAt + CLASH_ANNOUNCE_MS + CLASH_COUNTDOWN_MS + CLASH_PRESS_MS,
			phase: 'announce',
			attackerPresses: 0,
			defenderPresses: 0,
			lastPressAt: {},
		};
		await this.store.saveClashState(gameId, clashState);
		this.publisher.publish({
			type: 'clash_start',
			gameId,
			attackerKey,
			defenderKey,
			target: CLASH_TARGET,
			duration: CLASH_PRESS_MS / 1000,
			attacker,
			defender,
			phase: 'announce',
			startAt: startedAt,
			announceDeadline: clashState.announceDeadline,
			countdownDeadline: clashState.countdownDeadline,
			pressDeadline: clashState.pressDeadline,
			attackerPresses: 0,
			defenderPresses: 0,
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
		clash.reconnectDeadline = Date.now() + 30000; // 30s reconnect window
		clash.waitingForReconnect = color;
		await this.store.saveClashState(gameId, clash);

		this.publisher.publish({
			type: 'clash_frozen',
			gameId,
			reason: 'player_disconnected',
			disconnectedPlayer: color,
			reconnectDeadline: clash.reconnectDeadline,
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
	 * Validates phase (pressing only), key match, press-cap, and press deadline.
	 * `isBot` bypasses key/seat validation (bots pass '' as key).
	 */
	async recordPress(gameId: string, color: PlayerColor, key: string, isBot = false): Promise<number> {
		const clash = await this.store.loadClashState(gameId);
		if (!clash) return 0;

		// Only presses during the PRESS phase count; before that the keys aren't revealed.
		if (clash.phase !== 'pressing') return 0;
		if (Date.now() > clash.pressDeadline) return 0;

		if (!isBot) {
			// Validate key matches the player's assigned key.
			const expectedKey = color === clash.attacker ? clash.attackerKey : clash.defenderKey;
			if (key !== expectedKey) return 0;
		}

		// Don't allow presses if player is disconnected and past deadline
		if (clash.waitingForReconnect && clash.reconnectDeadline && Date.now() > clash.reconnectDeadline) {
			return 0;
		}

		// Server-side press cap: min CLASH_PRESS_CAP_MS between accepted presses per side.
		const last = clash.lastPressAt?.[color];
		if (typeof last === 'number' && Date.now() - last < CLASH_PRESS_CAP_MS) return 0;

		const count = await this.store.recordClashPress(gameId, color);
		// (recordClashPress persisted the press + lastPressAt in one save.)
		// Broadcast the live count to EVERYONE in the room so both players' HUDs
		// stay in sync. The caller (socket-handlers) separately gets `count`.
		this.publisher.publish({
			type: 'clash_press',
			gameId,
			color,
			presses: count,
		});
		return count;
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
			loserPresses: loser === clash.attacker ? clash.attackerPresses : clash.defenderPresses,
		});

		await this.store.clearClashState(gameId);
	}
}
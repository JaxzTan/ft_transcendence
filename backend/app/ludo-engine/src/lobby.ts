import { RedisGameStore } from './redis';
import { EventPublisher } from './socket/event-publisher';
import type { PlayerColor } from './types';

const SLOT_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow'];

export class LobbyManager {
  constructor(private store: RedisGameStore, private publisher: EventPublisher) {}

  async getLobbyState(gameId: string): Promise<{ players: { userId: string; color: PlayerColor; ready: boolean }[] } | null> {
    const data = await this.store.getMatchData(gameId);
    if (!data) return null;

    const players = [];
    for (let i = 1; i <= 4; i++) {
      const userId = data[`player${i}_id`];
      if (!userId) continue;
      const color = (data[`player${i}_color`] as PlayerColor) || SLOT_COLORS[i - 1];
      const ready = (data.readyPlayers || '').split(',').includes(color);
      players.push({ userId, color, ready });
    }
    return { players };
  }

  async handleSelectColor(gameId: string, userId: string, color: PlayerColor): Promise<void> {
    const data = await this.store.getMatchData(gameId);
    if (!data || data.status !== 'WAITING') {
      throw new Error('Game is not in waiting state');
    }

    // Find which slot this user is in
    const slotIndex = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].indexOf(userId);
    if (slotIndex === -1) {
      throw new Error('You are not a player in this game');
    }

    // Check if color is already taken by another player
    const currentColorKey = `player${slotIndex + 1}_color`;
    const currentColor = (data[currentColorKey] as PlayerColor) || SLOT_COLORS[slotIndex];
    if (currentColor === color) return; // already has this color

    const takenBy = [data.player1_id, data.player2_id, data.player3_id, data.player4_id]
      .find((id, idx) => id && id !== userId && (data[`player${idx + 1}_color`] as string) === color);

    if (takenBy) {
      // Swap: give requested color to requester, take the other player's color
      const otherSlot = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].indexOf(takenBy);
      const otherColorKey = `player${otherSlot + 1}_color`;
      const otherColor = data[otherColorKey] as PlayerColor;

      await this.store.updateMatchData(gameId, {
        [currentColorKey]: color,
        [otherColorKey]: otherColor,
      });
    } else {
      // Color is free, just assign
      await this.store.updateMatchData(gameId, { [currentColorKey]: color });
    }

    // Mirror the swap into the live engine GameState so display and gameplay
    // (turn/move ownership is color-keyed) stay in sync. This is pre-game only
    // (status === 'WAITING' guard above), so board pieces are untouched — all
    // still sitting in base — only seat *identity* moves between the two slots.
    const state = await this.store.loadGameState(gameId);
    if (state) {
      const a = state.players.find(p => p.color === currentColor);
      const b = state.players.find(p => p.color === color);
      if (a && b) {
        const { color: _colorA, ...aRest } = a;
        const { color: _colorB, ...bRest } = b;
        Object.assign(a, bRest);
        Object.assign(b, aRest);
        await this.store.saveGameState(gameId, state);
      }
    }
  }

  async handleReadyCheck(gameId: string): Promise<boolean> {
    const data = await this.store.getMatchData(gameId);
    if (!data || data.status !== 'WAITING') return false;

    const activePlayers = [data.player1_id, data.player2_id, data.player3_id, data.player4_id].filter(Boolean);
    if (activePlayers.length < 2) return false;

    // Check all active players have selected colors
    for (let i = 1; i <= 4; i++) {
      const userId = data[`player${i}_id`];
      if (!userId) continue;
      const color = data[`player${i}_color`];
      if (!color) return false; // hasn't selected color
    }

    // Check all active players are ready
    const readyColors = (data.readyPlayers || '').split(',').filter(Boolean);
    for (let i = 1; i <= 4; i++) {
      const userId = data[`player${i}_id`];
      if (!userId) continue;
      const color = data[`player${i}_color`];
      if (!readyColors.includes(color)) return false;
    }

    return true;
  }
}

import { RedisGameStore } from './redis';
import { EventPublisher } from './socket/event-publisher';
import type { PlayerColor } from './types';

const SLOT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

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
    if (data[currentColorKey] === color) return; // already has this color

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

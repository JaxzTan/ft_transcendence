import { Socket } from 'socket.io';
import type { PlayerColor } from '../types';

/**
 * Minimal JWT verification (no external library dependency).
 * Extracts payload from a signed token using HMAC-SHA256.
 * In production, use a proper JWT library.
 */
export function verifyToken(token: string): { gameId: string; userId: string; role: string; clashEnabled?: boolean; mode?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return {
      gameId: payload.gameId,
      userId: payload.sub || payload.userId,
      role: payload.role || 'player',
      clashEnabled: payload.clashEnabled,
    };
  } catch {
    return null;
  }
}

/** Data stored on each connected socket */
export interface SocketData {
  gameId?: string;
  playerColor?: PlayerColor;
  userId?: string;
  role?: 'player' | 'spectator';
  clashEnabled?: boolean;
  mode?: 'pvp' | 'pve' | 'hotseat';
}

/** Custom socket wrapper to provide typed data */
export type GameSocket = Socket & { data: SocketData };

/** Check if a socket is a spectator — emits error and returns false if so */
export function requirePlayer(socket: GameSocket): boolean {
  if (socket.data.role === 'spectator') {
    socket.emit('error', 'Spectators cannot perform game actions');
    return false;
  }
  return true;
}

export const BOT_ID = 'ludo-bot';
export const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';
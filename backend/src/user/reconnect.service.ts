import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReconnectService implements OnModuleInit, OnModuleDestroy {
  // Track pending reconnects: userId -> { timer, gameId, timestamp }
  private pendingReconnects = new Map<string, { timer: NodeJS.Timeout; gameId: string; timestamp: number }>();
  private readonly RECONNECT_WINDOW = 45000; // 45 seconds in milliseconds

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Clean up any stale timers on startup
    console.log('[ReconnectService] Initialized with 45s reconnect window');
  }

  onModuleDestroy() {
    // Clear all timers on shutdown
    for (const [userId, data] of this.pendingReconnects) {
      clearTimeout(data.timer);
    }
    this.pendingReconnects.clear();
  }

  /**
   * Start a reconnect window for a disconnected user
   * @returns true if timer started, false if already pending
   */
  async startReconnectWindow(userId: string, gameId: string): Promise<boolean> {
    // Cancel existing timer if any
    if (this.pendingReconnects.has(userId)) {
      this.clearReconnectWindow(userId);
    }

    console.log(`[ReconnectService] Starting 45s reconnect window for user ${userId} in game ${gameId}`);

    const timer = setTimeout(async () => {
      console.log(`[ReconnectService] Reconnect window expired for user ${userId}`);
      await this.handleReconnectExpired(userId, gameId);
      this.pendingReconnects.delete(userId);
    }, this.RECONNECT_WINDOW);

    this.pendingReconnects.set(userId, {
      timer,
      gameId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Clear reconnect window (user successfully reconnected)
   */
  clearReconnectWindow(userId: string): boolean {
    const data = this.pendingReconnects.get(userId);
    if (data) {
      clearTimeout(data.timer);
      this.pendingReconnects.delete(userId);
      console.log(`[ReconnectService] Cleared reconnect window for user ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Check if user has a pending reconnect window
   */
  hasPendingReconnect(userId: string): boolean {
    return this.pendingReconnects.has(userId);
  }

  /**
   * Get pending reconnect data
   */
  getPendingReconnect(userId: string) {
    return this.pendingReconnects.get(userId);
  }

  /**
   * Handle reconnect window expiration
   * User didn't reconnect in time, mark as truly offline
   */
  private async handleReconnectExpired(userId: string, gameId: string) {
    try {
      // Update user status to offline
      await this.prisma.db.user.update({
        where: { id: userId },
        data: {
          isOnline: false,
          status: 'offline',
        },
      });

      console.log(`[ReconnectService] User ${userId} marked offline (no reconnect within 45s)`);

      // TODO: Notify ludo-engine to handle game timeout/abandonment
      // This could trigger game end logic if the user was in an active game
    } catch (error) {
      console.error(`[ReconnectService] Error handling reconnect expiry for user ${userId}:`, error);
    }
  }
}
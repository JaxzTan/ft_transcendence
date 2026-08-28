import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';

import { randomUUID } from 'crypto';
import { secret } from '../secrets';

// ─── Types ───────────────────────────────────────────────────────────────────

// notification types.
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_removed'
  | 'friend_declined'
  | 'game_invite'
  | 'achievement'
  | 'match_finished'
  | 'match_cancelled'
  | 'profile_updated'
  | 'display_name_changed'
  | 'friend_online'
  | 'friend_offline';

// Shape of the payload written to DB and pushed over SSE.
export interface NotificationPayload {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string; // ISO string
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationService implements OnModuleDestroy {
  // Redis publisher — sends notifications to the Pub/Sub channel.
  private pub: Redis;
  // Redis subscriber — listens for notifications on per-user channels.
  private sub: Redis;

  // In-memory map of active SSE connections per user.
  // One user can have multiple tabs open, so each userId maps to an array
  // of rxjs Subjects. When a notification arrives from Redis Pub/Sub,
  // every Subject in the array gets the event (= every open tab).
  private clients = new Map<string, Subject<NotificationPayload>[]>();

  // Subjects connected to the GLOBAL broadcast channel ("notify:all").
  // Every SSE client is added here too, so broadcast() events reach all
  // online users without being persisted per-recipient.
  private broadcastClients = new Set<Subject<NotificationPayload>>();

  constructor(private readonly prisma: PrismaService) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6479', 10);
    const password = secret('REDIS_PASSWORD');
    const opts = { host, port, password, retryStrategy: (t: number) => Math.min(t * 50, 2000) };

    this.pub = new Redis(opts);
    this.sub = new Redis(opts);

    this.pub.on('error', (e) => console.error('Notification pub Redis error:', (e as Error).message));
    this.sub.on('error', (e) => console.error('Notification sub Redis error:', (e as Error).message));

    // Listen for messages on channels we subscribe to.
    // When a service calls notify(), it publishes to `notify:<userId>`.
    // This handler picks it up and pushes to every SSE Subject for that user.
    this.sub.on('message', (channel: string, message: string) => {
      try {
        const data: NotificationPayload = JSON.parse(message);
        if (channel === 'notify:all') {
          // Global broadcast — every connected SSE client gets it.
          for (const subject of this.broadcastClients) {
            subject.next(data);
          }
          return;
        }
        // channel = "notify:<userId>"
        const userId = channel.replace('notify:', '');
        const subjects = this.clients.get(userId);
        if (!subjects || subjects.length === 0) return;
        for (const subject of subjects) {
          subject.next(data);
        }
      } catch {
        console.error('Failed to parse notification message:', message);
      }
    });

    // Subscribe the global broadcast channel once — every SSE connection also
    // receives events published to `notify:all`.
    this.sub.subscribe('notify:all').catch((err) => {
      console.error('Failed to subscribe to notify:all:', err);
    });
  }

  onModuleDestroy() {
    this.pub.quit();
    this.sub.quit();
  }

  // ─── SSE connection management ───────────────────────────────────────────

  /**
   * Called when a client opens the SSE stream.
   * Returns an Observable the controller pipes into the SSE response.
   * On first connection for a userId, subscribes to the Redis channel.
   */
  subscribe(userId: string): Observable<NotificationPayload> {
    const subject = new Subject<NotificationPayload>();
    this.broadcastClients.add(subject);

    const existing = this.clients.get(userId);
    if (existing) {
      // Another tab already open — just add this Subject.
      existing.push(subject);
    } else {
      // First tab — subscribe to the Redis channel.
      this.clients.set(userId, [subject]);
      this.sub.subscribe(`notify:${userId}`).catch((err) => {
        console.error(`Failed to subscribe to notify:${userId}:`, err);
      });
    }

    // When the SSE connection closes (client navigates away / closes tab),
    // clean up this Subject and unsubscribe from Redis if no tabs remain.
    subject.subscribe({
      complete: () => this.removeClient(userId, subject),
      error: () => this.removeClient(userId, subject),
    });

    return subject.asObservable();
  }

  /** Remove a single SSE client. Unsubscribes from Redis when the last tab closes. */
  private removeClient(userId: string, subject: Subject<NotificationPayload>) {
    this.broadcastClients.delete(subject);
    const subjects = this.clients.get(userId);
    if (!subjects) return;

    const idx = subjects.indexOf(subject);
    if (idx !== -1) subjects.splice(idx, 1);

    if (subjects.length === 0) {
      this.clients.delete(userId);
      this.sub.unsubscribe(`notify:${userId}`).catch(() => {});
    }
  }

  // ─── Emit a notification ─────────────────────────────────────────────────

  /**
   * Any backend service calls this to send a notification to a user.
   * It persists the notification in Postgres and publishes to Redis Pub/Sub
   * so any connected SSE client receives it instantly.
   */
  async notify(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // 1. Persist to DB so it shows up in the bell dropdown on next page load.
    const row = await this.prisma.db.notification.create({
      data: { userId, type, payload: payload as Record<string, any> },
    });

    // 2. Build the SSE payload.
    const event: NotificationPayload = {
      id: row.id,
      type: type,
      payload,
      read: false,
      createdAt: row.createdAt.toISOString(),
    };

    // 3. Publish to Redis — the subscriber handler (in constructor) pushes
    //    it to every SSE Subject for this user.
    await this.pub.publish(`notify:${userId}`, JSON.stringify(event));
  }

  /**
   * Send a TRANSIENT global broadcast to every online user (SSE toast only).
   * Unlike notify(), nothing is persisted to Postgres — offline users simply
   * don't see it, and the bell/unread badge is never flooded.
   */
  async broadcast(type: NotificationType, payload: Record<string, unknown>): Promise<void> {
    const event: NotificationPayload = {
      id: randomUUID(),
      type,
      payload,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await this.pub.publish('notify:all', JSON.stringify(event));
  }

  /**
   * Send a TRANSIENT per-user notification (SSE toast only, never persisted).
   * Same delivery path as notify() — publishes to `notify:<userId>` so exactly
   * that user's open tabs receive it — but skips the Postgres write, so
   * ephemeral events (e.g. friend online/offline) can't flood the bell.
   */
  async notifyTransient(userId: string, type: NotificationType, payload: Record<string, unknown>): Promise<void> {
    const event: NotificationPayload = {
      id: randomUUID(),
      type,
      payload,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await this.pub.publish(`notify:${userId}`, JSON.stringify(event));
  }

  // ─── REST helpers (for the controller) ───────────────────────────────────

  /** Fetch unread notifications for the bell dropdown on page load. */
  async getUnread(userId: string): Promise<NotificationPayload[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type as NotificationType,
      payload: r.payload as Record<string, unknown>,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Mark a single notification as read. */
  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  /** Mark all notifications as read for a user. */
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

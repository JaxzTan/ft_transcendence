import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';
import { PresenceService } from '../presence/presence.service';
import { MatchService } from '../match/match.service';
import { secret } from '../secrets';

@Injectable()
export class FriendsService {
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly matchService: MatchService,
  ) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = secret('REDIS_PASSWORD');

    this.redis = new Redis({ host, port, password, retryStrategy: (t) => Math.min(t * 50, 2000) });
    this.redis.on('error', (error) => console.error('Redis error:', (error as Error).message));
  }

  // ─── Game Invitations ───────────────────────────────────────────────────
  // Presence is poll-based (no push transport in this backend), so invites are
  // a short-lived Redis record the invitee's client picks up on its next poll —
  // same idiom as presence:{userId}, just keyed for invites instead of status.
  async inviteToGame(userId: string, friendId: string) {
    if (userId === friendId) throw new BadRequestException('Cannot invite yourself');

    const friendship = await this.prisma.db.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId, status: 'accepted' },
          { userId: friendId, friendId: userId, status: 'accepted' },
        ],
      },
    });
    if (!friendship) throw new ForbiddenException('You are not friends with this user');

    const match = await this.matchService.createInvite(userId);
    const inviter = await this.prisma.db.user.findUnique({ where: { id: userId }, select: { username: true } });

    await this.redis.set(
      `invite:${friendId}`,
      JSON.stringify({
        gameId: match.gameId,
        inviteCode: match.inviteCode,
        fromUsername: inviter?.username || 'A friend',
        createdAt: Date.now(),
      }),
      'EX', 300,
    );

    return { message: 'Invite sent', gameId: match.gameId };
  }

  async getPendingInvite(userId: string) {
    const raw = await this.redis.get(`invite:${userId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async dismissInvite(userId: string) {
    await this.redis.del(`invite:${userId}`);
    return { message: 'Dismissed' };
  }

  async sendFriendRequest(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const targetUser = await this.prisma.db.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.db.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Already friends');
      } else if (existing.status === 'pending') {
        throw new BadRequestException('Friend request already pending');
      } else if (existing.status === 'blocked') {
        throw new ForbiddenException('Cannot send request - user is blocked');
      }
    }

    const friendship = await (this.prisma.db.friendship.create as any)({
      data: {
        id: `${userId}-${targetUserId}`,
        user: { connect: { id: userId } },
        friend: { connect: { id: targetUserId } },
        status: 'pending',
      },
      include: {
        user: { select: { id: true, username: true, avatarStyle: true } },
        friend: { select: { id: true, username: true, avatarStyle: true } },
      },
    });

    return friendship;
  }

  async acceptFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.db.friendship.findFirst({
      where: {
        id: requestId,
        friendId: userId,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, username: true, avatarStyle: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    const updated = await this.prisma.db.friendship.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        user: { select: { id: true, username: true, avatarStyle: true } },
        friend: { select: { id: true, username: true, avatarStyle: true } },
      },
    });

    return updated;
  }

  async declineFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.db.friendship.findFirst({
      where: {
        id: requestId,
        friendId: userId,
        status: 'pending',
      },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.db.friendship.delete({
      where: { id: requestId },
    });

    return { message: 'Friend request declined' };
  }

  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prisma.db.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
        status: 'accepted',
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.db.friendship.delete({
      where: { id: friendship.id },
    });

    return { message: 'Friend removed' };
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.db.friendship.findMany({
      where: {
        OR: [
          { userId, status: 'accepted' },
          { friendId: userId, status: 'accepted' },
        ],
      },
      include: {
        user: { select: { id: true, username: true, avatarStyle: true, rating: true } },
        friend: { select: { id: true, username: true, avatarStyle: true, rating: true } },
      },
    });

    const friends = friendships.map((f) => {
      const friend = f.userId === userId ? f.friend : f.user;
      return {
        id: friend.id,
        username: friend.username,
        avatarStyle: friend.avatarStyle,
        rating: friend.rating,
        friendsSince: f.createdAt,
      };
    });

    const statuses = await this.presence.getStatuses(friends.map((f) => f.id));
    return friends.map((f) => ({ ...f, status: statuses[f.id] }));
  }

  async getFriendRequests(userId: string) {
    const [sent, received] = await Promise.all([
      this.prisma.db.friendship.findMany({
        where: {
          userId,
          status: 'pending',
        },
        include: {
          friend: { select: { id: true, username: true, avatarStyle: true } },
        },
      }),
      this.prisma.db.friendship.findMany({
        where: {
          friendId: userId,
          status: 'pending',
        },
        include: {
          user: { select: { id: true, username: true, avatarStyle: true } },
        },
      }),
    ]);

    return {
      sent: sent.map((r) => ({
        id: r.id,
        userId: r.friend.id,
        username: r.friend.username,
        avatarStyle: r.friend.avatarStyle,
        createdAt: r.createdAt,
      })),
      received: received.map((r) => ({
        id: r.id,
        userId: r.user.id,
        username: r.user.username,
        avatarStyle: r.user.avatarStyle,
        createdAt: r.createdAt,
      })),
    };
  }

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.prisma.db.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      },
    });

    if (existing) {
      const updated = await this.prisma.db.friendship.update({
        where: { id: existing.id },
        data: { status: 'blocked' },
        include: {
          user: { select: { id: true, username: true, avatarStyle: true } },
          friend: { select: { id: true, username: true, avatarStyle: true } },
        },
      });
      return updated;
    } else {
      const blocked = await (this.prisma.db.friendship.create as any)({
        data: {
          id: `${userId}-${targetUserId}-blocked`,
          userId,
          friendId: targetUserId,
          status: 'blocked',
        },
        include: {
          user: { select: { id: true, username: true, avatarStyle: true } },
          friend: { select: { id: true, username: true, avatarStyle: true } },
        },
      });
      return blocked;
    }
  }
}
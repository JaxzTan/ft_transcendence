import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return friends;
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
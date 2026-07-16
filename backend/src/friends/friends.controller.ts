import { Controller, Post, Get, Patch, Delete, UseGuards, Request, Param, Body } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('api/friends/request/:userId')
  sendRequest(@Request() req: { user: { sub: string } }, @Param('userId') targetUserId: string) {
    return this.friends.sendFriendRequest(req.user.sub, targetUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api/friends/accept/:requestId')
  acceptRequest(@Request() req: { user: { sub: string } }, @Param('requestId') requestId: string) {
    return this.friends.acceptFriendRequest(requestId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api/friends/decline/:requestId')
  declineRequest(@Request() req: { user: { sub: string } }, @Param('requestId') requestId: string) {
    return this.friends.declineFriendRequest(requestId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('api/friends/remove/:friendId')
  removeFriend(@Request() req: { user: { sub: string } }, @Param('friendId') friendId: string) {
    return this.friends.removeFriend(req.user.sub, friendId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('api/friends')
  getFriends(@Request() req: { user: { sub: string } }) {
    return this.friends.getFriends(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('api/friends/requests')
  getRequests(@Request() req: { user: { sub: string } }) {
    return this.friends.getFriendRequests(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api/friends/block/:userId')
  blockUser(@Request() req: { user: { sub: string } }, @Param('userId') targetUserId: string) {
    return this.friends.blockUser(req.user.sub, targetUserId);
  }
}
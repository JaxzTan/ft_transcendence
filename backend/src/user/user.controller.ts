import { Controller, Get, Param, Query, Request, UseGuards, Body, Patch, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReconnectService } from './reconnect.service';

@Controller('api/user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly reconnectService: ReconnectService,
  ) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.userService.getPublicProfile(username);
  }

  @Get(':username/games')
  async getUserGames(
    @Param('username') username: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    return this.userService.getUserGames(username, pageNum, limitNum);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Request() req: { user: { sub: string } }, @Body('gameId') gameId: string, @Body('reason') reason?: string) {
    const userId = req.user.sub;
    
    // Update online status
    await this.userService.updateOnlineStatus(userId, false);
    
    // Increment disconnect count
    await this.userService.incrementDisconnectCount(userId);
    
    // Start reconnect window (45 seconds)
    await this.reconnectService.startReconnectWindow(userId, gameId);
    
    return {
      success: true,
      message: 'Disconnect recorded. Reconnect window: 45s',
      gameId,
      reason: reason || 'unknown',
    };
  }

  @Post('reconnect')
  @UseGuards(JwtAuthGuard)
  async reconnect(@Request() req: { user: { sub: string } }, @Body('gameId') gameId: string) {
    const userId = req.user.sub;
    
    // Check if user has a pending reconnect window
    const hasPending = this.reconnectService.hasPendingReconnect(userId);
    
    if (hasPending) {
      // Clear the reconnect window
      this.reconnectService.clearReconnectWindow(userId);
      
      // Update online status
      await this.userService.updateOnlineStatus(userId, true);
      
      // Increment reconnect count
      await this.userService.incrementReconnectCount(userId);
      
      return {
        success: true,
        message: 'Reconnection successful',
        gameId,
        wasPending: true,
      };
    } else {
      // No pending reconnect (maybe expired or never disconnected)
      await this.userService.updateOnlineStatus(userId, true);
      
      return {
        success: true,
        message: 'User set online',
        gameId,
        wasPending: false,
      };
    }
  }
}

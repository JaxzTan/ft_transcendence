import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

}

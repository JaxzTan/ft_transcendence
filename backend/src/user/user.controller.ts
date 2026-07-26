import { Controller, Get, Post, Delete, Param, UseGuards, Request, Res, UploadedFile, UseInterceptors, NotFoundException, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
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

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadAvatar(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PNG, JPEG, GIF, WebP');
    }
    return this.userService.uploadAvatar(req.user.id, file.buffer, file.mimetype);
  }

  @Get(':username/avatar')
  async getAvatar(@Param('username') username: string, @Res() res: Response) {
    const result = await this.userService.getAvatar(username);
    if (!result) {
      throw new NotFoundException('No custom avatar set');
    }
    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(result.data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  async deleteAvatar(@Request() req: { user: { id: string } }) {
    return this.userService.deleteAvatar(req.user.id);
  }
}
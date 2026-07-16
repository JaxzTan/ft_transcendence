import { Controller, Post, Body, Get, Request, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  register(@Body('username') username: string, @Body('password') password: string, @Body('avatarStyle') avatarStyle?: string) {
    return this.auth.register(username, password, avatarStyle);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  login(@Body('username') username: string, @Body('password') password: string) {
    return this.auth.login(username, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: { user: { sub: string; username: string } }) {
    return { id: req.user.sub, username: req.user.username };
  }

  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  updateAvatar(@Request() req: { user: { sub: string } }, @Body('avatarStyle') avatarStyle: string) {
    return this.auth.updateAvatarStyle(req.user.sub, avatarStyle);
  }
}

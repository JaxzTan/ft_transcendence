import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TwoFactorDto } from './dto/twofactor.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard, GithubAuthGuard, FortyTwoAuthGuard } from './oauth.guards';
import { secret } from '../secrets';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JwtModule expiresIn
// Fallback matches the compose entry point: nginx publishes 8443 -> 443.
const FRONTEND_URL = secret('FRONTEND_URL') ?? 'https://localhost:8443';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // No cookie here anymore: the account must be email-verified before its
  // first login, and every login must pass the 2FA code step.
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Target of the emailed verification link — lands in a browser tab, so it
  // answers with a redirect to the SPA rather than JSON.
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const ok = await this.authService.verifyEmail(token ?? '');
    res.redirect(`${FRONTEND_URL}/login?${ok ? 'verified=1' : 'error=invalid-verification-link'}`);
  }

  // Factor one only — answers { pending, pendingToken }, never a session.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Factor two: emailed code + pendingToken buy the actual session cookie.
  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(@Body() dto: TwoFactorDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.completeTwoFactor(dto.pendingToken, dto.code);
    this.setAuthCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return { user: req.user };
  }

  // ---- Google OAuth ----
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  // ---- GitHub OAuth ----
  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  // ---- 42 OAuth ----
  @Get('42')
  @UseGuards(FortyTwoAuthGuard)
  fortyTwoAuth() {}

  @Get('42/callback')
  @UseGuards(FortyTwoAuthGuard)
  fortyTwoCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  // OAuth passes factor one (the provider vouched for them), but 2FA still
  // applies: email a code and hand the browser to the SPA's /2fa page.
  private async finishOAuth(req: Request, res: Response) {
    const user = req.user as { id: string; username: string; email: string | null };
    if (!user.email) {
      // Strategies only forward provider-verified emails; without one we have
      // nowhere to send login codes, so this account cannot exist here.
      res.redirect(`${FRONTEND_URL}/login?error=no-verified-email`);
      return;
    }
    const { pendingToken } = await this.authService.startTwoFactor(user.id, user.email);
    res.redirect(`${FRONTEND_URL}/2fa?token=${pendingToken}`);
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }
}

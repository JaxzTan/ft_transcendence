import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TwoFactorDto } from './dto/twofactor.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard, GithubAuthGuard, FortyTwoAuthGuard } from './oauth.guards';
import { secret } from '../secrets';

// Access-token cookie: JwtStrategy reads this exact name. Short-lived.
const ACCESS_COOKIE = 'token';
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000; // 15 min, matches JwtModule expiresIn
// Refresh-token cookie: only the auth routes need it, so it's scoped to
// /api/auth rather than sent on every API call. Long-lived.
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/auth';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches SessionService TTL
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

  // Factor two: emailed code + pendingToken buy the actual session cookies.
  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(@Body() dto: TwoFactorDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.completeTwoFactor(
      dto.pendingToken,
      dto.code,
    );
    this.setSessionCookies(res, accessToken, refreshToken);
    return { user };
  }

  // Silent re-auth: the browser sends only the refresh cookie and gets a fresh
  // access token (plus a rotated refresh token). No password or 2FA involved.
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE],
    );
    this.setSessionCookies(res, accessToken, refreshToken);
    return { user };
  }

  // Password reset, step one: always answers with the same generic message,
  // whether or not the email is registered (no account enumeration).
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // Password reset, step two: the emailed token + a new password.
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Revoke the refresh token server-side so it can't be reused, then drop
    // both cookies. clearCookie must repeat the path the cookie was set with.
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
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

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
    const base = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };
    // Access token: path '/' so it rides along on every /api call for verification.
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, path: '/', maxAge: ACCESS_MAX_AGE_MS });
    // Refresh token: path /api/auth so it's only sent to refresh + logout.
    res.cookie(REFRESH_COOKIE, refreshToken, { ...base, path: REFRESH_PATH, maxAge: REFRESH_MAX_AGE_MS });
  }
}

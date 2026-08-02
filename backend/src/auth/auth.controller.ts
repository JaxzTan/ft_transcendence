import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TwoFactorDto } from './dto/twofactor.dto';
import { TwoFactorSettingDto } from './dto/two-factor-setting.dto';
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
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.register(dto);
    this.setAuthCookie(req, res, token);
    return { user };
  }

  // Factor one. With 2FA on, answers { twoFactorRequired: true, pendingToken }
  // and no session. With 2FA off, the password is enough: sets the session
  // cookies and answers { twoFactorRequired: false, user }.
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto);
    this.setAuthCookie(req, res, token);
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

  // ---- 2FA preference (logged-in user toggles their own) ----
  @UseGuards(JwtAuthGuard)
  @Get('2fa')
  getTwoFactor(@Req() req: Request) {
    return this.authService.getTwoFactorSetting((req.user as { id: string }).id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('2fa')
  setTwoFactor(@Req() req: Request, @Body() dto: TwoFactorSettingDto) {
    return this.authService.setTwoFactorSetting((req.user as { id: string }).id, dto.enabled);
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

  private finishOAuth(req: Request, res: Response) {
    const user = req.user as { id: string; username: string };
    const { token } = this.authService.issueToken(user.id, user.username);
    this.setAuthCookie(req, res, token);
    res.redirect(FRONTEND_URL);
  }

  private setAuthCookie(req: Request, res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };
    // Access token: path '/' so it rides along on every /api call for verification.
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, path: '/', maxAge: ACCESS_MAX_AGE_MS });
    // Refresh token: path /api/auth so it's only sent to refresh + logout.
    res.cookie(REFRESH_COOKIE, refreshToken, { ...base, path: REFRESH_PATH, maxAge: REFRESH_MAX_AGE_MS });
  }
}

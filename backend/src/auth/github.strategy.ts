import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from './auth.service';
import { requireSecret } from '../secrets';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: requireSecret('GITHUB_CLIENT_ID'),
      clientSecret: requireSecret('GITHUB_CLIENT_SECRET'),
      callbackURL: requireSecret('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value;
    return this.authService.validateOAuthLogin({
      provider: 'github',
      providerAccountId: profile.id,
      email,
      displayName: profile.displayName ?? profile.username,
      usernameSeed: profile.username ?? `github_${profile.id}`,
    });
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { isTunnelRequest } from '../secrets';

// Both the localhost and ngrok OAuth apps are registered at once (under
// distinct passport strategy names, see auth.module.ts), so a single guard
// per provider has to pick the right one per request rather than at boot.
// This mirrors the Host-header check AuthController uses to pick the
// post-login redirect target — same signal, same reason: ngrok forwards the
// original Host header, so it tells us which OAuth app's client/callback the
// browser is actually going to complete the round trip with.
function tunnelAwareGuard(localStrategy: string, tunnelStrategy: string, provider: string) {
  const LocalGuard = AuthGuard(localStrategy);
  const TunnelGuard = AuthGuard(tunnelStrategy);

  @Injectable()
  class TunnelAwareAuthGuard implements CanActivate {
    // This class is returned from a factory and used as an exported base —
    // EVERY member must be public or `nest build` fails. (#-private fields and
    // private constructor params both trip the rule.)
    readonly local = new LocalGuard();
    readonly tunnel = new TunnelGuard();

    constructor(public readonly jwt: JwtService) {}

    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Request>();
      const guard = isTunnelRequest(req.get('host')) ? this.tunnel : this.local;

      // "Add a sign-in method" intent: when the browser already holds a valid
      // access-token cookie, treat this OAuth startup as a LINK — sign a
      // short-lived oauth-link token into the provider `state` so the callback
      // links the provider account to the logged-in user instead of logging
      // them in (or creating a new account). No cookie = normal login (no state).
      let state: string | undefined;
      const accessToken = req.cookies?.['token'];
      if (typeof accessToken === 'string') {
        try {
          const payload = this.jwt.verify(accessToken) as { sub?: string };
          if (payload.sub) {
            state = this.jwt.sign(
              { sub: payload.sub, p: provider, purpose: 'oauth-link' },
              { expiresIn: '10m' },
            );
          }
        } catch {
          /* invalid/expired access token -> normal login */
        }
      }

      if (state) {
        const opts = (guard as any).options ?? {};
        (guard as any).options = { ...opts, state };
      }
      return guard.canActivate(context);
    }
  }

  return TunnelAwareAuthGuard;
}

@Injectable()
export class GoogleAuthGuard extends tunnelAwareGuard('google', 'google-tunnel', 'google') {}

@Injectable()
export class GithubAuthGuard extends tunnelAwareGuard('github', 'github-tunnel', 'github') {}

@Injectable()
export class FortyTwoAuthGuard extends tunnelAwareGuard('42', '42-tunnel', '42') {}

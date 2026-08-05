import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { isTunnelRequest } from '../secrets';

// Both the localhost and ngrok OAuth apps are registered at once (under
// distinct passport strategy names, see auth.module.ts), so a single guard
// per provider has to pick the right one per request rather than at boot.
// This mirrors the Host-header check AuthController uses to pick the
// post-login redirect target — same signal, same reason: ngrok forwards the
// original Host header, so it tells us which OAuth app's client/callback the
// browser is actually going to complete the round trip with.
function tunnelAwareGuard(localStrategy: string, tunnelStrategy: string) {
  const LocalGuard = AuthGuard(localStrategy);
  const TunnelGuard = AuthGuard(tunnelStrategy);

  @Injectable()
  class TunnelAwareAuthGuard implements CanActivate {
    #local = new LocalGuard();
    #tunnel = new TunnelGuard();

    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Request>();
      const guard = isTunnelRequest(req.get('host')) ? this.#tunnel : this.#local;
      return guard.canActivate(context);
    }
  }

  return TunnelAwareAuthGuard;
}

@Injectable()
export class GoogleAuthGuard extends tunnelAwareGuard('google', 'google-tunnel') {}

@Injectable()
export class GithubAuthGuard extends tunnelAwareGuard('github', 'github-tunnel') {}

@Injectable()
export class FortyTwoAuthGuard extends tunnelAwareGuard('42', '42-tunnel') {}

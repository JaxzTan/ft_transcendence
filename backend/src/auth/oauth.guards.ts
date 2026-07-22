import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Triggers the Google strategy: on the first route it redirects to Google,
// on the callback route it processes Google's response.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {}

@Injectable()
export class FortyTwoAuthGuard extends AuthGuard('42') {}

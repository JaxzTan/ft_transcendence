import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as fs from 'fs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secretPath = process.env.JWT_SECRET_FILE || '/secrets/ludo_engine_credentials.txt';
    let secret: string;
    try {
      secret = fs.readFileSync(secretPath, 'utf8').trim();
    } catch {
      secret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; username: string }) {
    return { sub: payload.sub, username: payload.username };
  }
}
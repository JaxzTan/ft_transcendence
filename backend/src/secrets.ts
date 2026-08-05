import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Secrets live as one-value-per-file under a secrets directory, named after the
 * variable they hold in lower case: JWT_SECRET -> jwt_secret.txt. Nothing
 * sensitive comes from .env any more — .env is only used for non-secret compose
 * interpolation (ports, LAN/ngrok wiring).
 *
 * Directory resolution: SECRETS_DIR wins, then /secrets (the compose mount),
 * then ../secrets relative to cwd so `npm run start:dev` on the host works
 * against the same files the containers see.
 */
function resolveDir(): string {
  const candidates = [
    process.env.SECRETS_DIR,
    '/secrets',
    join(process.cwd(), '..', 'secrets'),
    join(process.cwd(), 'secrets'),
  ].filter(Boolean) as string[];

  return candidates.find((dir) => existsSync(dir)) ?? '/secrets';
}

const SECRETS_DIR = resolveDir();
const cache = new Map<string, string | undefined>();

/** Read a secret by its variable name. Returns undefined if there's no file. */
export function secret(name: string): string | undefined {
  if (cache.has(name)) return cache.get(name);

  const file = join(SECRETS_DIR, `${name.toLowerCase()}.txt`);
  let value: string | undefined;

  try {
    value = readFileSync(file, 'utf8').trim() || undefined;
  } catch {
    // Env fallback keeps CI and one-off scripts working when no secrets
    // directory is mounted. Not a path any deployed service should take.
    value = process.env[name];
    if (value) {
      console.warn(`[secrets] ${file} missing, falling back to process.env.${name}`);
    }
  }

  cache.set(name, value);
  return value;
}

// Per-request check used by oauth.guards.ts (which OAuth app's strategy to
// run) and AuthController (which frontend origin to redirect back to) — both
// switch on which origin a given browser actually came in on. ngrok forwards
// the original Host header unmodified (no --host-header=rewrite in
// NGROK_FLAGS), so a request that hit the tunnel carries the public ngrok
// host; a local request carries localhost/the LAN IP. Both a local and a
// tunnelled client can be live against the same running backend at once, so
// this has to be resolved per request rather than from a boot-time flag.
export function isTunnelRequest(host: string | undefined): boolean {
  return !!host && host.includes('ngrok');
}

/** Same as secret(), but fails fast instead of silently signing with undefined. */
export function requireSecret(name: string): string {
  const value = secret(name);
  if (!value) {
    throw new Error(
      `Missing secret ${name}: expected ${join(SECRETS_DIR, `${name.toLowerCase()}.txt`)}`,
    );
  }
  return value;
}

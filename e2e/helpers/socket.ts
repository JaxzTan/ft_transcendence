import { io, Socket } from 'socket.io-client';

// ludo-engine's port 3001 is NOT published to the host (compose.yaml only
// `expose`s it inside the docker network) -- by design, per
// nginx/conf/nginx.conf:140-146, the browser (and anything outside the
// compose network) reaches the engine exclusively via nginx's
// `/socket.io/` proxy on the same TLS origin as the SPA. So the real,
// reachable "engine URL" from the test runner's perspective is BASE_URL,
// not a raw ENGINE_URL:3001. ENGINE_URL is kept only as an override for
// running against the engine directly from inside the docker network.
const ENGINE_URL = process.env.ENGINE_URL ?? process.env.BASE_URL ?? 'https://localhost:8443';

export interface ConnectAuth {
  token?: string;
}

export function connect(auth?: ConnectAuth): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(ENGINE_URL, {
      transports: ['websocket'],
      reconnection: false,
      auth: auth ?? {},
      forceNew: true,
      rejectUnauthorized: false, // self-signed cert on the nginx origin
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`connect() timed out against ${ENGINE_URL}`));
    }, 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export interface CapturedMessage {
  event: string;
  args: unknown[];
}

/**
 * Emits `event` with `args` on `socket`, then collects every inbound message
 * (any event) for ~1200ms via onAny(). This is the ONLY way this suite
 * observes server behavior for socket tests — never assert on an empty
 * result being a pass (see rejected()).
 */
export function probe(socket: Socket, event: string, ...args: unknown[]): Promise<CapturedMessage[]> {
  const collected: CapturedMessage[] = [];
  const handler = (ev: string, ...a: unknown[]) => collected.push({ event: ev, args: a });
  socket.onAny(handler);
  socket.emit(event, ...args);
  return new Promise((resolve) => {
    setTimeout(() => {
      socket.offAny(handler);
      resolve(collected);
    }, 1200);
  });
}

const REJECTION_PATTERN = /error|reject|invalid|denied|unauthor/i;

/**
 * True only on positive evidence of refusal (a message whose event name or
 * payload matches the rejection pattern). An empty message list returns
 * false, not true -- silence is never a pass. See suite Rule 2.
 */
export function rejected(messages: CapturedMessage[]): boolean {
  if (messages.length === 0) return false;
  return messages.some(({ event, args }) => {
    if (REJECTION_PATTERN.test(event)) return true;
    return args.some((a) => {
      const text = typeof a === 'string' ? a : safeStringify(a);
      return REJECTION_PATTERN.test(text);
    });
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

/** Builds an unsigned/forged JWT: header.payload.garbage-signature, base64url encoded. */
export function forgeToken(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url('not-a-real-signature');
  return `${header}.${body}.${signature}`;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

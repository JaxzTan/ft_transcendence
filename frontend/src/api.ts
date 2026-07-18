/**
 * API + WebSocket helpers. Use these instead of raw fetch/WebSocket.
 *
 * Two things they handle that hand-rolled calls get wrong:
 *
 * 1. Relative URLs. nginx serves the SPA and reverse-proxies /api to the
 *    backend on the same origin, so there is no API base URL to configure —
 *    localhost, LAN IP and the ngrok domain all just work. Never hardcode a
 *    host here; that is what breaks the moment you leave localhost.
 *
 * 2. ngrok's free-tier interstitial. Without the skip header ngrok answers
 *    API calls with its "You are about to visit…" warning (ERR_NGROK_6024)
 *    instead of your JSON. Setting Accept: application/json does NOT dodge it.
 */

/** fetch() against the backend. Path is relative to /api, e.g. api('/games'). */
export function api(path: string, init: RequestInit = {}) {
  // Headers instance, not a spread: spreading a Headers object silently
  // yields {} and would drop the caller's headers.
  const headers = new Headers(init.headers)
  headers.set('ngrok-skip-browser-warning', 'true')
  return fetch(`/api${path}`, { ...init, headers })
}

/** JSON GET/POST/… returning the parsed body, throwing on non-2xx. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await api(path, { ...init, headers })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} /api${path} → ${res.status}`)
  return res.json() as Promise<T>
}

/**
 * WebSocket to the backend, scheme derived from the page.
 * https page → wss://, http page → ws://. Handles ngrok (always https) and
 * the self-signed :443 LAN listener identically.
 *
 * Note: the browser WebSocket API cannot send custom headers, so the ngrok
 * interstitial can't be skipped that way — it doesn't apply to WS upgrades.
 */
export function socket(path: string) {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${scheme}://${location.host}/api${path}`)
}

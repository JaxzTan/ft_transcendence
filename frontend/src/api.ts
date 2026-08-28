// Wrapper for calls to protected API routes.
//
// Access tokens are short-lived (15 min), so a request can come back 401 simply
// because the access token expired — even though the user is still "logged in"
// (their refresh token is good for 7 days). When that happens we transparently
// POST /api/auth/refresh once (the browser sends the refresh cookie), which
// mints a new access token, then retry the original request.
//
// Single-flight: several requests can 401 at the same instant (e.g. on page
// load). They share ONE in-flight refresh promise, so we don't fire /refresh
// many times and trip over the refresh-token rotation (each rotation
// invalidates the previous refresh token).

// ngrok's free tier answers a fresh client's first request with an HTML
// "you are about to visit…" interstitial instead of proxying it through,
// unless this header is present. Harmless off ngrok — nginx/localhost just
// ignore it. Spreading a Headers instance (`{...init.headers}`) silently
// yields `{}`, so this goes through the Headers constructor instead.
function withNgrokHeader(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set('ngrok-skip-browser-warning', 'true')
  return { ...init, headers }
}

// 'ok'       — new access token minted, retry the original call
// 'expired'  — the refresh token itself is dead; the user really is signed out
// 'blocked'  — rate limited / server error / offline. Says NOTHING about
//              whether the session is valid, so callers must not treat it as a
//              logout; it is surfaced as the refresh response's own status.
type RefreshResult =
  | { outcome: 'ok' }
  | { outcome: 'expired' }
  // `status` and `retryAfter` are carried from the refresh response so callers
  // can report it accurately without issuing another request at the limiter
  // that just turned us away.
  | { outcome: 'blocked'; status: number; retryAfter: string | null }

let refreshing: Promise<RefreshResult> | null = null

function refreshOnce(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', withNgrokHeader({ method: 'POST' }))
      .then((r): RefreshResult => {
        if (r.ok) return { outcome: 'ok' }
        if (r.status === 401 || r.status === 403) return { outcome: 'expired' }
        return { outcome: 'blocked', status: r.status, retryAfter: r.headers.get('Retry-After') }
      })
      .catch((): RefreshResult => ({ outcome: 'blocked', status: 503, retryAfter: null }))
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

// ---------------------------------------------------------------------------
// Cross-tab refresh coordination.
//
// The access token is short-lived (15 min). When it expires, EVERY open tab
// (this app keeps /home, /profile, /friends, /game all open) hits 401 at once.
// If each tab then POSTs /api/auth/refresh with the SAME refresh cookie, the
// server's refresh-token ROTATION consumes the token on the first call — the
// losing tabs get a 401 from /refresh, apiFetch reports 'expired', and the user
// is bounced to /login even though their session is perfectly fine.
//
// Cookies (including the rotated refresh cookie) are shared browser-wide, so
// only ONE tab actually needs to refresh; the others wait for that refresh to
// land, then retry their original request against the fresh cookie jar.
// ---------------------------------------------------------------------------
const REFRESH_LOCK_KEY = 'lr.refreshLock'
const REFRESH_LOCK_TTL_MS = 6000
const REFRESH_WAIT_MS = 5000

/** Try to claim the cross-tab refresh lock (best-effort, TTL-guarded). */
function acquireRefreshLock(): boolean {
  const now = Date.now()
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY)
    if (raw) {
      const existing = JSON.parse(raw) as { at: number }
      if (now - existing.at < REFRESH_LOCK_TTL_MS) return false // another tab holds it
    }
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ at: now }))
    // Re-read to confirm we won the write race against another tab.
    const got = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) ?? 'null')
    return got?.at === now
  } catch {
    return true // localStorage unavailable — fall back to the local single-flight
  }
}

function releaseRefreshLock(): void {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY)
  } catch { /* ignore */ }
}

/** Wait until the cross-tab refresh lock is released (bounded). */
async function waitForRefreshLock(maxMs = REFRESH_WAIT_MS): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      if (!localStorage.getItem(REFRESH_LOCK_KEY)) return
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 50))
  }
}

/**
 * Like fetch(), but for authenticated endpoints. On a 401 it attempts a single
 * silent token refresh and retries once.
 *
 * If the refresh token itself is expired/revoked, the original 401 is returned
 * so the caller can treat the user as logged out. If the refresh could not be
 * *attempted* properly — rate limited, server error, offline — the refresh
 * response is returned instead, so a caller checking for 401 doesn't mistake
 * "try again shortly" for "you are signed out".
 *
 * Note: the request is retried by re-issuing `init` as-is, so keep bodies as
 * plain values (strings/objects), not one-shot streams.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const finalInit = withNgrokHeader(init)
  const res = await fetch(input, finalInit)
  if (res.status !== 401) return res

  // Another tab is mid-refresh: wait for it, then retry against the shared
  // cookie jar (which now holds the rotated tokens). Only if that still 401s
  // do we perform our own refresh below.
  if (!acquireRefreshLock()) {
    await waitForRefreshLock()
    const retry = await fetch(input, finalInit)
    if (retry.status !== 401) return retry
    // Retry still 401 (the other tab's refresh failed) — fall through.
  }

  const shouldRelease = acquireRefreshLock()
  try {
    const result = await refreshOnce()
    if (result.outcome === 'ok') return fetch(input, finalInit)
    if (result.outcome === 'expired') return res // session really is over — hand back the 401

    // 'blocked': report the refresh's own status (429/5xx) rather than the
    // misleading 401 from the original call. Synthesised locally — re-probing
    // would mean another request at the limiter that just rejected us.
    return new Response(null, {
      status: result.status,
      headers: result.retryAfter ? { 'Retry-After': result.retryAfter } : undefined,
    })
  } finally {
    if (shouldRelease) releaseRefreshLock()
  }
}

// ---------------------------------------------------------------------------
// Typed JSON helpers for REST calls that return JSON.
// Builds on apiFetch so 401 → refresh → retry is transparent.
// ---------------------------------------------------------------------------
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = (body as { message?: string | string[] } | null)?.message
    throw new Error(Array.isArray(msg) ? msg.join('. ') : (msg ?? `Request failed (${res.status})`))
  }
  return res.json() as Promise<T>
}

export const getApi = <T>(path: string) => request<T>(path)
export const postApi = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined })
export const deleteApi = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body: body != null ? JSON.stringify(body) : undefined })
export const patchApi = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })

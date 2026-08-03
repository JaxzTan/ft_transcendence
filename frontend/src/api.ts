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

let refreshing: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

/**
 * Like fetch(), but for authenticated endpoints. On a 401 it attempts a single
 * silent token refresh and retries once. If the refresh fails (refresh token
 * expired/revoked), the original 401 is returned so the caller can treat the
 * user as logged out.
 *
 * Note: the request is retried by re-issuing `init` as-is, so keep bodies as
 * plain values (strings/objects), not one-shot streams.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 401) return res

  const refreshed = await refreshOnce()
  if (!refreshed) return res // session really is over — hand back the 401
  return fetch(input, init)
}

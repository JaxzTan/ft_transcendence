import { APIRequestContext, APIResponse, BrowserContext, Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://localhost:8443';

// nginx/conf/nginx.conf:20,99 puts /api/auth/login behind its own
// `limit_req_zone ... zone=login rate=5r/m` with `burst=5 nodelay` and no
// `limit_req_status`, so nginx's default 503 (not 429) is what overflow
// looks like. Once several independent tests each log in, a sequential
// suite run easily exceeds 5r/m+5burst from one IP. This is a real,
// legitimate rate limit doing its job -- not a bug to work around by
// weakening assertions -- so setup logins retry with backoff here instead
// of asserting on it.
const LOGIN_RETRY_DELAYS_MS = [3000, 8000, 15000, 20000];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Logs in via the real API (POST /api/auth/login, body { identifier, password }
 * -- confirmed in e2e/DISCOVERED.md §3, NOT { username, password }).
 * Session is carried entirely via httpOnly cookies (`token`, `refresh_token`);
 * there is no bearer token to extract. Retries with backoff on 429/503 --
 * see LOGIN_RETRY_DELAYS_MS above -- since this is ordinary test setup, not
 * a test of the rate limiter itself.
 */
export async function loginViaApi(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<APIResponse> {
  let lastRes: APIResponse | undefined;
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { identifier, password },
      failOnStatusCode: false,
    });
    if (res.status() === 200) return res;
    lastRes = res;
    if ((res.status() === 429 || res.status() === 503) && attempt < LOGIN_RETRY_DELAYS_MS.length) {
      await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    break;
  }
  throw new Error(`Login for ${identifier} failed: ${lastRes?.status()} ${await lastRes?.text()}`);
}

/**
 * Logs in through the real UI form. Selectors confirmed in e2e/DISCOVERED.md §2.
 * Retries the whole form-submit + navigation on a same-page bounce (nginx's
 * `login` zone rejecting the underlying POST) -- see LOGIN_RETRY_DELAYS_MS above.
 */
export async function loginViaUi(page: Page, identifier: string, password: string): Promise<void> {
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill(identifier);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/home/, { timeout: 10000 });
      return;
    } catch {
      if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
        await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`loginViaUi(${identifier}) never reached /home after ${LOGIN_RETRY_DELAYS_MS.length + 1} attempts`);
    }
  }
}

/** Copies a logged-in browser context's session cookies onto an API request context. */
export async function cookiesFor(context: BrowserContext) {
  return context.cookies(BASE);
}

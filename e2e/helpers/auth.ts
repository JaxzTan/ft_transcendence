import { APIRequestContext, APIResponse, BrowserContext, Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://localhost:8443';

/**
 * Logs in via the real API (POST /api/auth/login, body { identifier, password }
 * -- confirmed in e2e/DISCOVERED.md §3, NOT { username, password }).
 * Session is carried entirely via httpOnly cookies (`token`, `refresh_token`);
 * there is no bearer token to extract.
 */
export async function loginViaApi(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<APIResponse> {
  const res = await request.post(`${BASE}/api/auth/login`, {
    data: { identifier, password },
    failOnStatusCode: false,
  });
  if (res.status() !== 200) {
    throw new Error(`Login for ${identifier} failed: ${res.status()} ${await res.text()}`);
  }
  return res;
}

/** Logs in through the real UI form. Selectors confirmed in e2e/DISCOVERED.md §2. */
export async function loginViaUi(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(identifier);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/home/, { timeout: 10000 });
}

/** Copies a logged-in browser context's session cookies onto an API request context. */
export async function cookiesFor(context: BrowserContext) {
  return context.cookies(BASE);
}

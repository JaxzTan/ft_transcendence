import { test, expect, request as pwRequest } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

const PLAIN_API_URL = process.env.PLAIN_API_URL ?? 'http://localhost:3000';

// Authenticated route list, from e2e/DISCOVERED.md §2.5 (FULL_ROUTES minus PUBLIC_ROUTES).
const AUTHENTICATED_ROUTES = [
  '/home',
  '/leaderboard',
  '/friends',
  '/profile',
  '/gamelobby',
  '/gamelobby/table',
  '/game',
];

// Filters per BRIEF.md G-02: favicon 404s, ERR_CERT*/self-signed warnings, React DevTools nag.
function isIgnorableIssue(text: string): boolean {
  if (/favicon/i.test(text)) return true;
  if (/ERR_CERT/i.test(text)) return true;
  if (/self-signed/i.test(text)) return true;
  if (/self signed certificate/i.test(text)) return true;
  if (/Download the React DevTools/i.test(text)) return true;
  return false;
}

test('G-02 no console errors or warnings on any route', async ({ page }) => {
  test.setTimeout(180_000);
  // nginx's `auth` zone (rate=10r/m, burst=10, no limit_req_status -- see
  // nginx.conf:19,108-109) fronts /api/auth/, which every authenticated page
  // mount re-checks. A back-to-back sweep of this many routes can exceed that
  // budget and get bounced to /login by the RT-09 defect (store.tsx treats any
  // non-2xx as logged out); that's RT-09's bug, not this test's -- detect the
  // bounce and retry with backoff instead of letting it masquerade as a
  // console-error finding for whatever route happened to trip it.
  const issues: string[] = [];
  let currentRoute = 'initial-load';

  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (isIgnorableIssue(text)) return;
    issues.push(`[console.${type}] ${currentRoute} — ${text}`);
  });

  page.on('pageerror', (err) => {
    const text = err.message || String(err);
    if (isIgnorableIssue(text)) return;
    issues.push(`[pageerror] ${currentRoute} — ${text}`);
  });

  const visit = async (route: string, isAuthed: boolean) => {
    currentRoute = route;
    const before = issues.length;
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    if (isAuthed && new URL(page.url()).pathname === '/login') {
      // Bounced by the rate limiter, not a real finding for this route -- drop
      // whatever it logged, cool down, and retry.
      issues.length = before;
      for (const backoff of [8_000, 15_000, 25_000]) {
        await page.waitForTimeout(backoff);
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        if (new URL(page.url()).pathname !== '/login') break;
        issues.length = before;
      }
    }
  };

  await visit('/login', false);
  await visit('/register', false);

  currentRoute = 'login-via-ui';
  await loginViaUi(page, 'Alice', 'password');

  for (const route of AUTHENTICATED_ROUTES) {
    await visit(route, true);
  }

  expect(issues, `Console/page issues found:\n${issues.join('\n')}`).toEqual([]);
});

test('G-03 @defect HTTPS everywhere (plaintext API port must not answer)', async () => {
  const ctx = await pwRequest.newContext();
  try {
    let res;
    try {
      res = await ctx.get(`${PLAIN_API_URL}/api/leaderboard`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
    } catch (err) {
      // Connection refused (port closed) — this is a PASS.
      return;
    }

    const status = res.status();
    const location = res.headers()['location'];

    const isRedirectToHttps =
      [301, 302, 307, 308].includes(status) && !!location && location.startsWith('https://');

    expect(
      isRedirectToHttps,
      `Expected plaintext ${PLAIN_API_URL}/api/leaderboard to be connection-refused or redirect to https://, ` +
        `but got status ${status}${location ? ` with Location: ${location}` : ' with no Location header'}. ` +
        `Body: ${(await res.text()).slice(0, 300)}`,
    ).toBe(true);
  } finally {
    await ctx.dispose();
  }
});

test('G-05a @defect /privacy renders unauthenticated, no client redirect', async ({ page }) => {
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');

  const pathname = new URL(page.url()).pathname;
  const bodyText = await page.evaluate(() => document.body.innerText.trim());

  expect(
    pathname === '/privacy' && bodyText.length > 200,
    `Expected /privacy to stay at /privacy with >200 chars of body text. ` +
      `Got pathname="${pathname}", bodyText.length=${bodyText.length}.`,
  ).toBe(true);
});

test('G-05b @defect /terms renders unauthenticated, no client redirect', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');

  const pathname = new URL(page.url()).pathname;
  const bodyText = await page.evaluate(() => document.body.innerText.trim());

  expect(
    pathname === '/terms' && bodyText.length > 200,
    `Expected /terms to stay at /terms with >200 chars of body text. ` +
      `Got pathname="${pathname}", bodyText.length=${bodyText.length}.`,
  ).toBe(true);
});

test('G-05c @defect /login has a privacy/terms/tos link', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const count = await page.locator('a[href*="privacy"], a[href*="terms"], a[href*="tos"]').count();

  expect(
    count,
    `Expected at least one link matching a[href*="privacy"|"terms"|"tos"] on /login, found ${count}.`,
  ).toBeGreaterThanOrEqual(1);
});

test('G-07 server-side validation on login endpoint is independent of the frontend', async () => {
  // Deliberately targets PLAIN_API_URL (bypassing nginx), not just "bypassing
  // the SPA" as originally scoped -- nginx/conf/nginx.conf:20,99 puts
  // /api/auth/login behind its own `zone=login rate=5r/m burst=5 nodelay`
  // with no `limit_req_status`, so nginx answers overflow with a bare 503
  // that has nothing to do with payload validity. That 503 was observed
  // corrupting this exact test when run after other tests had already used
  // part of the shared per-IP budget. The DTO validation this case is
  // actually probing (class-validator on LoginDto) lives in the NestJS
  // layer and runs identically whether reached via nginx or directly, so
  // hitting the backend directly removes the confound without weakening
  // what's being asserted.
  const ctx = await pwRequest.newContext();
  type Case = { description: string; body: unknown };

  const cases: Case[] = [
    { description: 'empty object {}', body: {} },
    { description: 'wrong types { identifier: 12345, password: true }', body: { identifier: 12345, password: true } },
    { description: 'null fields { identifier: null, password: null }', body: { identifier: null, password: null } },
    {
      description: 'oversized identifier ("a".repeat(10000))',
      body: { identifier: 'a'.repeat(10000), password: 'x' },
    },
    {
      description: 'unknown props { identifier: "a", password: "b", isAdmin: true }',
      body: { identifier: 'a', password: 'b', isAdmin: true },
    },
    {
      description: 'nested injection { identifier: { $ne: null }, password: "x" }',
      body: { identifier: { $ne: null }, password: 'x' },
    },
  ];

  const nonConforming: string[] = [];

  try {
    for (const c of cases) {
      const res = await ctx.post(`${PLAIN_API_URL}/api/auth/login`, {
        data: c.body,
        failOnStatusCode: false,
      });
      const status = res.status();
      if (status < 400 || status >= 500) {
        nonConforming.push(`${c.description} — observed status ${status}`);
      }
    }
  } finally {
    await ctx.dispose();
  }

  expect(
    nonConforming,
    `Expected every payload to receive a 4xx status. Non-conforming cases:\n${nonConforming.join('\n')}`,
  ).toEqual([]);
});

import { test, expect, request as pwRequest, type Page } from '@playwright/test';
import { loginViaUi, cookiesFor } from './helpers/auth';

// Matches e2e/helpers/auth.ts's BASE resolution exactly.
const BASE = process.env.BASE_URL ?? 'https://localhost:8443';

// Profile page "window header" — e2e/DISCOVERED.md does not itself document a
// selector for this, but its §5/§7 sourcing method (read the real component)
// applies: frontend/src/pages/Profile.tsx renders
//   <div className="window-header"><span>{t('profile.windowHeader', { username, id })}</span>...
// where `username` is `(profile.displayName || profile.username).toUpperCase()`.
// `/profile` with no `?u=` query defaults to the logged-in user's own profile
// (Profile.tsx: `const username = query.get('u') || user?.username`), so this
// header always names the viewing context's own account — the friend list and
// match-history participant names live elsewhere in the page body, so scoping
// to this selector avoids the whole-body false-failure the brief warns about.
const PROFILE_HEADER_SELECTOR = '.window-header';

const ACCOUNTS = ['Alice', 'NeonKnight', 'ShadowFox', 'Viper_X'] as const;
const PASSWORD = 'password';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * loginViaUi wrapped with retries against nginx's `login` zone (rate=5r/m,
 * burst=5, exact-match on /api/auth/login — nginx/conf/nginx.conf). This
 * zone is keyed by source IP and shared with every other spec file/agent
 * hitting the same docker-compose stack from this machine, so its budget
 * can be transiently exhausted by traffic this test never generated —
 * confirmed empirically: a bare `curl` login POST returned 503/429/200 on
 * consecutive 5s-spaced attempts while nothing in this file was running.
 * Retrying past that external contention is a test-setup concern, not a
 * softening of what G-06/RT-09/RT-05 actually assert — none of those cases
 * are about the login endpoint's own throttle.
 */
async function robustLoginViaUi(
  page: Page,
  identifier: string,
  password: string,
  attempts = 8,
): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await loginViaUi(page, identifier, password);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      await delay(5000 + i * 3000);
    }
  }
}

/**
 * Navigates to /profile and retries the navigation (not a fresh login — the
 * session cookies are untouched) if it bounces to /login. A full navigation
 * to /profile re-triggers the app's mount-time GET /api/auth/me; under the
 * same ambient nginx `auth`-zone contention described above, THAT call can
 * itself get a transient 503/429 and the client treats it as logged-out
 * (this is exactly the RT-09 defect mechanism) even though the cookie-backed
 * session is fine. Retrying the plain navigation once the shared budget
 * recovers is test-setup robustness against that unrelated noise — it does
 * not touch the actual G-06 leakage assertion below.
 */
async function gotoProfileRobust(page: Page, attempts = 6): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname === '/profile') return;
    if (i === attempts) return; // give up silently; the caller's assertion will surface it
    await delay(4000 + i * 2000);
  }
}

test('G-06 @multi no cross-session leakage across 4 concurrent accounts', async ({ browser }) => {
  test.setTimeout(240_000);

  const contexts = await Promise.all(
    ACCOUNTS.map(() => browser.newContext({ baseURL: BASE, ignoreHTTPSErrors: true })),
  );
  const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

  try {
    // Stagger logins by ~1.5s each — simultaneous bursts trip nginx's auth
    // rate limit (rate=10r/m) and would produce a false failure that's
    // actually RT-09, not what G-06 is testing.
    for (let i = 0; i < ACCOUNTS.length; i++) {
      await robustLoginViaUi(pages[i], ACCOUNTS[i], PASSWORD);
      if (i < ACCOUNTS.length - 1) {
        await delay(1500);
      }
    }

    // All four navigate to /profile simultaneously.
    await Promise.all(pages.map((p) => gotoProfileRobust(p)));

    const finalUrls = pages.map((p) => new URL(p.url()).pathname);
    expect(
      finalUrls,
      `Expected all 4 contexts to reach /profile. Got: ${finalUrls.join(', ')} ` +
        `(a redirect to /login here is the RT-09 rate-limit-false-logout mechanism, not G-06 leakage).`,
    ).toEqual(ACCOUNTS.map(() => '/profile'));

    await Promise.all(
      pages.map((p) => p.locator(PROFILE_HEADER_SELECTOR).waitFor({ state: 'visible', timeout: 15_000 })),
    );

    const headerTexts = await Promise.all(
      pages.map((p) => p.locator(PROFILE_HEADER_SELECTOR).innerText()),
    );

    const leaks: string[] = [];
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const own = ACCOUNTS[i];
      const header = headerTexts[i].toUpperCase();

      if (!header.includes(own.toUpperCase())) {
        leaks.push(`Context for ${own}: header does not contain own username. Header text: "${headerTexts[i]}"`);
        continue;
      }

      for (let j = 0; j < ACCOUNTS.length; j++) {
        if (i === j) continue;
        const other = ACCOUNTS[j];
        if (header.includes(other.toUpperCase())) {
          leaks.push(
            `Context for ${own}: header leaks other account's username "${other}". Header text: "${headerTexts[i]}"`,
          );
        }
      }
    }

    expect(leaks, `Cross-session leakage found:\n${leaks.join('\n')}`).toEqual([]);
  } finally {
    // Close sequentially, not Promise.all: closing 4 contexts concurrently
    // with trace recording on (playwright.config.ts: trace: 'retain-on-failure')
    // has been observed to throw a spurious ENOENT on a shared trace resource
    // file when the flushes race each other. That's a teardown artifact, not
    // an assertion failure, so it's also swallowed per-context.
    for (const ctx of contexts) {
      try {
        await ctx.close();
      } catch (err) {
        console.warn('Context close failed (non-fatal, teardown only):', err);
      }
    }
  }
});

test('RT-09 @defect @multi rate-limit false logout does not survive session reload', async ({ browser }) => {
  test.setTimeout(240_000);

  const context = await browser.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const page: Page = await context.newPage();

  try {
    await robustLoginViaUi(page, 'Alice', PASSWORD);

    const cookies = await cookiesFor(context);
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const apiContext = await pwRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Cookie: cookieHeader },
    });

    const statuses: number[] = [];
    try {
      // ~30 sequential requests (not parallel) to exhaust nginx's auth-zone
      // burst allowance (nginx/conf/nginx.conf: zone=auth, rate=10r/m,
      // burst=10 nodelay, on location /api/auth/).
      for (let i = 0; i < 30; i++) {
        const res = await apiContext.get(`${BASE}/api/auth/me`, { failOnStatusCode: false });
        statuses.push(res.status());
      }
    } finally {
      await apiContext.dispose();
    }

    // Empirical correction to the brief's assumption: nginx/conf/nginx.conf
    // has no `limit_req_status` directive on the auth zone, so a rejected
    // request gets nginx's *default* limit_req rejection status, 503 — not
    // 429. Verified against this stack: 30 sequential requests came back as
    // a handful of 200s followed by 503s, never 429. The defect mechanism is
    // unaffected either way: frontend/src/store.tsx's `/api/auth/me` handler
    // treats *any* non-2xx (401 excepted, which gets a refresh-and-retry) as
    // logged-out, so 503 triggers the same false-logout path 429 would.
    const rateLimitedStatuses = statuses.filter((s) => s === 429 || s === 503);
    const sawRateLimit = rateLimitedStatuses.length > 0;

    test.skip(
      !sawRateLimit,
      `nginx rate limiter never returned 429 or 503 across 30 sequential /api/auth/me requests; ` +
        `the limiter isn't configured as expected. Observed status codes: ${statuses.join(', ')}`,
    );

    // At least one rate-limit rejection was observed — reload the ORIGINAL
    // BROWSER PAGE and confirm the still-valid, cookie-backed session isn't
    // bounced to /login just because the mount-time /api/auth/me call got
    // rate-limited.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const pathname = new URL(page.url()).pathname;
    const firstRateLimitAt = statuses.findIndex((s) => s === 429 || s === 503) + 1;
    const rateLimitStatusesSeen = [...new Set(rateLimitedStatuses)].join('/');

    expect(
      pathname,
      `Expected session to survive rate-limited /api/auth/me (first ${rateLimitStatusesSeen} at request ` +
        `#${firstRateLimitAt} of 30; statuses: ${statuses.join(', ')}), but reload landed on "${pathname}".`,
    ).not.toBe('/login');
  } finally {
    await context.close();
  }
});

test('RT-05 @defect @multi second session login does not silently kill the first', async ({ browser }) => {
  test.setTimeout(240_000);

  const contextA = await browser.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const contextB = await browser.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });

  try {
    const pageA = await contextA.newPage();
    await robustLoginViaUi(pageA, 'Alice', PASSWORD);

    await delay(2000);

    const pageB = await contextB.newPage();
    await robustLoginViaUi(pageB, 'Alice', PASSWORD);

    await pageA.reload();
    await pageA.waitForLoadState('networkidle');
    await pageA.waitForTimeout(500);

    const pathname = new URL(pageA.url()).pathname;
    const stillAuthenticated = pathname !== '/login';

    // Acceptable alternative PASS: an explicit "session ended elsewhere"
    // style notice. No such copy exists anywhere in frontend/src/locales
    // today (checked), so this will realistically never fire, but the
    // check is kept per the brief's defined-behaviour carve-out.
    const bodyText = await pageA.evaluate(() => document.body.innerText);
    const hasExplicitNotice = /session[^.]{0,40}(elsewhere|ended|another device|logged out)/i.test(bodyText)
      || /(elsewhere|another device)[^.]{0,40}session/i.test(bodyText);

    expect(
      stillAuthenticated || hasExplicitNotice,
      `Expected context A to remain authenticated after context B logged in as the same account, ` +
        `or to show an explicit "session ended elsewhere" notice. Got pathname="${pathname}", ` +
        `no explicit notice found in body text (silent logout).`,
    ).toBe(true);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});

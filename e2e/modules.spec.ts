import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginViaApi, loginViaUi } from './helpers/auth';

// nginx fronts /api/auth/login with a strict zone (rate=5r/m, burst=5, nodelay — see
// nginx/conf/nginx.conf) that returns a flat 503 once exhausted, independent of the
// backend's own @Throttle. This suite logs in several times, so logins are paced to
// stay under that budget, with one reactive retry as a safety net.
let lastLoginAt = 0;
const LOGIN_SPACING_MS = 13_000;

async function pace(waiter: (ms: number) => Promise<unknown>) {
  const wait = lastLoginAt + LOGIN_SPACING_MS - Date.now();
  if (wait > 0) await waiter(wait);
  lastLoginAt = Date.now();
}

async function rateLimitedLoginUi(page: Page, identifier: string, password: string) {
  await pace((ms) => page.waitForTimeout(ms));
  try {
    await loginViaUi(page, identifier, password);
  } catch (err) {
    await page.waitForTimeout(20_000);
    lastLoginAt = Date.now();
    await loginViaUi(page, identifier, password);
  }
}

async function rateLimitedLoginApi(request: APIRequestContext, identifier: string, password: string) {
  await pace((ms) => new Promise((r) => setTimeout(r, ms)));
  try {
    return await loginViaApi(request, identifier, password);
  } catch (err) {
    await new Promise((r) => setTimeout(r, 20_000));
    lastLoginAt = Date.now();
    return await loginViaApi(request, identifier, password);
  }
}

/**
 * Navigates to an authenticated route, tolerating the RT-09 false-logout defect:
 * nginx's `auth` zone (rate=10r/m) fronts /api/auth/me, which every full page
 * navigation re-fires on mount. Enough back-to-back page.goto() calls across this
 * file's tests can trip that limiter, and frontend/src/store.tsx treats the
 * resulting 429 as "not logged in", bouncing to /login. That's RT-09's bug, not
 * whatever a given test here is checking — detect the bounce and retry once after
 * a cool-down instead of letting it masquerade as this test's own failure.
 */
async function gotoAuthed(page: Page, route: string) {
  const backoffsMs = [8_000, 15_000, 25_000];
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  for (const backoff of backoffsMs) {
    if (new URL(page.url()).pathname !== '/login') return;
    await page.waitForTimeout(backoff);
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
}

/** Retries a same-session API call on 429/503 (nginx's `auth` zone) -- see gotoAuthed above. */
async function withRetry<T extends { status(): number }>(fn: () => Promise<T>): Promise<T> {
  const backoffsMs = [8_000, 15_000, 25_000];
  let res = await fn();
  for (const backoff of backoffsMs) {
    if (res.status() !== 429 && res.status() !== 503) return res;
    await new Promise((r) => setTimeout(r, backoff));
    res = await fn();
  }
  return res;
}

test('UM-01 PATCH /api/auth/profile updates displayName (also covers UM-08)', async ({ request }) => {
  test.setTimeout(120_000);
  // UM-08 ("profile update endpoint exists") is the same route/assertion as UM-01 —
  // no separate test written, per BRIEF.md's instruction to note it rather than duplicate.
  await rateLimitedLoginApi(request, 'Alice', 'password');

  const meRes = await withRetry(() => request.get('/api/auth/profile', { failOnStatusCode: false }));
  expect(meRes.status(), 'GET /api/auth/profile (to read the original displayName) failed').toBe(200);
  const meBody = await meRes.json();
  const originalDisplayName: string | undefined = meBody.user?.displayName;

  try {
    const patchRes = await withRetry(() =>
      request.patch('/api/auth/profile', {
        data: { displayName: 'pw-probe' },
        failOnStatusCode: false,
      }),
    );
    const status = patchRes.status();
    expect(
      [404, 405].includes(status),
      `PATCH /api/auth/profile should be a real, working route — got ${status}. Body: ${await patchRes.text()}`,
    ).toBe(false);

    const patchBody = await patchRes.json().catch(() => null);
    expect(
      status >= 200 && status < 300 && patchBody?.user?.displayName === 'pw-probe',
      `Expected a 2xx response with user.displayName === "pw-probe", got status ${status}, body: ${JSON.stringify(patchBody)}`,
    ).toBe(true);
  } finally {
    // Cleanup: leave Alice's account exactly as found.
    if (originalDisplayName !== undefined) {
      await request.patch('/api/auth/profile', {
        data: { displayName: originalDisplayName },
        failOnStatusCode: false,
      });
    }
  }
});

test('UM-02 default avatar image actually loads on /profile', async ({ page }) => {
  test.setTimeout(120_000);
  await rateLimitedLoginUi(page, 'Alice', 'password');
  await gotoAuthed(page, '/profile');

  const avatar = page.locator(`img[alt="Alice's avatar"]`).first();
  await expect(avatar, 'No <img alt="Alice\'s avatar"> found on /profile').toBeVisible();

  const loaded = await avatar.evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  );
  expect(loaded, 'Avatar <img> is visible but did not actually decode (complete && naturalWidth > 0 is false)').toBe(
    true,
  );
});

test('ST-02 leaderboard row figures appear in profile numeric set', async ({ page }) => {
  test.setTimeout(120_000);
  await rateLimitedLoginUi(page, 'Alice', 'password');

  await gotoAuthed(page, '/profile');
  const profileText = await page.evaluate(() => document.body.innerText);
  const profileNumbers = new Set((profileText.match(/\d+(\.\d+)?/g) ?? []).map(Number));

  await gotoAuthed(page, '/leaderboard');

  // Leaderboard rows are the only elements with this exact inline grid-template-columns
  // (frontend/src/pages/Leaderboard.tsx) — no data-testid exists, so we key off that.
  const row = page
    .locator('div[style*="270px 1.4fr 170px 170px 150px"]')
    .filter({ hasText: 'Alice' })
    .first();
  await expect(row, 'Could not find a leaderboard row containing "Alice"').toBeVisible();

  const cells = row.locator(':scope > div');
  const cellCount = await cells.count();
  expect(cellCount, `Expected 5 grid columns in a leaderboard row, found ${cellCount}`).toBe(5);

  // Column order: [0] rank badge, [1] pilot info, [2] rating, [3] matches played, [4] win rate.
  const ratingText = await cells.nth(2).innerText();
  const matchesText = await cells.nth(3).innerText();
  const winRateText = await cells.nth(4).innerText();
  const rowNumbers = [
    ...(ratingText.match(/\d+/g) ?? []),
    ...(matchesText.match(/\d+/g) ?? []),
    ...(winRateText.match(/\d+/g) ?? []),
  ].map(Number);

  const missing = rowNumbers.filter((n) => !profileNumbers.has(n));
  expect(
    missing,
    `Leaderboard figures [rating="${ratingText}", matches="${matchesText}", winRate="${winRateText}"] ` +
      `contain numbers not present anywhere in the profile page's numeric set: [${missing.join(', ')}]. ` +
      `Profile numbers seen: [${[...profileNumbers].join(', ')}].`,
  ).toEqual([]);
});

test('ST-04 no NaN/Infinity/undefined literals on profile or leaderboard', async ({ page }) => {
  test.setTimeout(150_000);
  await rateLimitedLoginUi(page, 'Alice', 'password');

  const badPattern = /\bNaN\b|\bInfinity\b|\bundefined\b/;
  for (const route of ['/profile', '/leaderboard']) {
    await gotoAuthed(page, route);
    const text = await page.evaluate(() => document.body.innerText);
    const match = text.match(badPattern);
    expect(match, `Found literal "${match?.[0]}" rendered in body text on ${route}`).toBeNull();
  }
});

test('ST-06 history pagination (?page=1&limit=2) actually limits rows', async ({ request }) => {
  const triedPaths = ['/api/user/Alice/games'];
  const bareRes = await request.get('/api/user/Alice/games', { failOnStatusCode: false });

  test.skip(
    bareRes.status() !== 200,
    `No history endpoint answered 200. Tried: ${triedPaths.join(', ')} — got ${bareRes.status()}.`,
  );

  const bareBody = await bareRes.json();
  const bareRows: unknown[] = Array.isArray(bareBody) ? bareBody : (bareBody.games ?? []);

  // Per BRIEF.md: only assert if the bare call actually returns more than 2 rows —
  // otherwise the parameterised call passing trivially proves nothing.
  test.skip(
    bareRows.length <= 2,
    `Bare GET /api/user/Alice/games returned only ${bareRows.length} row(s) (<=2) — nothing to ` +
      `meaningfully assert about pagination limiting; skipping rather than reporting a trivial pass.`,
  );

  const paramRes = await request.get('/api/user/Alice/games?page=1&limit=2', { failOnStatusCode: false });
  expect(paramRes.status(), 'GET /api/user/Alice/games?page=1&limit=2 did not return 200').toBe(200);
  const paramBody = await paramRes.json();
  const paramRows: unknown[] = Array.isArray(paramBody) ? paramBody : (paramBody.games ?? []);

  // `limit` IS a real, honoured query param per DISCOVERED.md §9 — this is expected to PASS,
  // not fail. Not tagged @defect: report the real (green) result rather than forcing red.
  expect(
    paramRows.length,
    `Expected <=2 rows with ?limit=2, got ${paramRows.length} (bare call returned ${bareRows.length}).`,
  ).toBeLessThanOrEqual(2);
});

test('GF-07 @defect no achievement is unlocked above the real win count (also covers GF-05)', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  // GF-05 ("achievement progress reflects real stats") is the same root cause and the
  // same card-level evidence as GF-07 — covered here rather than duplicated.
  const winsRes = await request.get('/api/user/Alice');
  expect(winsRes.status(), 'GET /api/user/Alice failed while reading the real win count').toBe(200);
  const winsBody = await winsRes.json();
  const wins: number = winsBody.wins;
  expect(typeof wins, `Expected a numeric wins field on /api/user/Alice, got ${JSON.stringify(winsBody.wins)}`).toBe(
    'number',
  );

  await rateLimitedLoginUi(page, 'Alice', 'password');
  await gotoAuthed(page, '/profile');
  await page.getByRole('button', { name: /ACHIEVEMENTS/i }).click();

  // The achievements grid is the only element with this exact inline
  // gridTemplateColumns (frontend/src/pages/Profile.tsx) — no data-testid exists.
  const grid = page.locator('div[style*="minmax(230px, 1fr)"]');
  await expect(grid, 'Achievements grid not found after switching tabs').toBeVisible();

  const cards = grid.locator(':scope > div');
  const cardCount = await cards.count();
  expect(cardCount, 'Expected at least one achievement card').toBeGreaterThan(0);

  const violations: string[] = [];
  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const text = await card.innerText();
    const m = text.match(/(\d+)\/(\d+)/); // "progress/target" — only rendered when target > 0
    if (!m) continue;
    const target = parseInt(m[2], 10);

    // Locked/unlocked is expressed ONLY via inline style (opacity 1 vs 0.55, per
    // e2e/DISCOVERED.md §2.7) — no class/data-state/aria attribute exists to key off.
    const opacity = await card.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    const unlocked = opacity > 0.9;

    if (unlocked && target > wins) {
      const title = text.split('\n')[0];
      violations.push(`"${title}" unlocked with threshold ${target} > actual wins ${wins} (progress text: "${m[0]}")`);
    }
  }

  expect(
    violations,
    `Achievement(s) unlocked above the real win count (${wins}):\n${violations.join('\n')}\n` +
      `Root cause: seeded rows set achievement flags directly with formulas unrelated to the ` +
      `thresholds the UI displays, bypassing normal post-game achievement evaluation entirely.`,
  ).toEqual([]);
});

test('2F-09 @defect toggling 2FA requires re-authentication before it takes effect', async ({ page }) => {
  test.setTimeout(120_000);
  await rateLimitedLoginUi(page, 'Alice', 'password');
  // CORRECTION to e2e/DISCOVERED.md §8: that discovery pass read AccountMenu.tsx
  // (unused) rather than the actually-rendered RetroNavbar.tsx. The real trigger
  // is a <button aria-label="Account Settings, Language and 2FA">, and the 2FA
  // control is a plain <div title="Toggle Two-Factor Authentication"> with NO
  // role or aria-checked at all -- state is only conveyed by a visible
  // ENABLED/DISABLED text badge. Confirmed from a live accessibility snapshot.
  const accountMenuBtn = page.getByRole('button', { name: 'Account Settings, Language and 2FA' });
  await expect(accountMenuBtn, 'Account menu trigger not found — bounced to /login?').toBeVisible({ timeout: 15_000 });
  await accountMenuBtn.click();

  const toggle = page.locator('[title="Toggle Two-Factor Authentication"]');
  await expect(toggle).toBeVisible();
  const before = (await toggle.innerText()).trim();

  await toggle.click();
  await page.waitForTimeout(600);

  const passwordInput = page.locator('input[type="password"]');
  const codeInput = page.locator(
    'input[autocomplete="one-time-code"], input[inputmode="numeric"], input[name*="code" i]',
  );
  const dialog = page.locator('[role="dialog"]');
  const challengeAppeared =
    (await passwordInput.count()) > 0 || (await codeInput.count()) > 0 || (await dialog.count()) > 0;

  const after = await toggle.innerText().catch(() => null);
  const stateFlipped = after !== null && after.trim() !== before;

  try {
    expect(
      challengeAppeared,
      `Expected a password input, code input, or role="dialog" to appear within ~600ms of toggling ` +
        `2FA, before the state changed. None appeared — aria-checked went from "${before}" to "${after}" ` +
        `with no confirmation step at all.`,
    ).toBe(true);
  } finally {
    // Cleanup: leave 2FA off (or as originally found) — a test that silently enables it
    // breaks every later login since no mail catcher exists to complete the challenge.
    if (!challengeAppeared && stateFlipped) {
      await toggle.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
});

test('AN-01..05 @defect analytics/activity/insights/dashboard module exists', async ({ page }) => {
  test.setTimeout(120_000);
  await rateLimitedLoginUi(page, 'Alice', 'password');
  await gotoAuthed(page, '/home');

  const sidebarText = await page.locator('aside').innerText();
  const sidebarLinkPattern = /analytic|activity|insight|dashboard/i;
  const sidebarLinkExists = sidebarLinkPattern.test(sidebarText);

  const candidateRoutes = ['/analytics', '/activity', '/insights', '/dashboard'];
  const survived: string[] = [];
  for (const route of candidateRoutes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    let pathname = new URL(page.url()).pathname;
    if (pathname === '/login') {
      // RT-09-style bounce, not a real "fell through to /home" result — retry once.
      await page.waitForTimeout(8_000);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      pathname = new URL(page.url()).pathname;
    }
    if (pathname === route) survived.push(route);
  }

  const pass = sidebarLinkExists || survived.length > 0;

  expect(
    pass,
    `No sidebar link matches /${sidebarLinkPattern.source}/i (sidebar text: "${sidebarText.replace(/\s+/g, ' ')}"), ` +
      `and none of [${candidateRoutes.join(', ')}] rendered without falling through to /home ` +
      `(routes that kept their own pathname: [${survived.join(', ') || 'none'}]). ` +
      `This minor module scores zero, so the demo total is 20/14, not 21/14.`,
  ).toBe(true);
});

test('OA-01 OAuth provider buttons render on /login (no click-through)', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const providers: Array<{ label: string; pattern: RegExp }> = [
    { label: '42/fortytwo/intra', pattern: /42|fortytwo|intra/i },
    { label: 'GitHub', pattern: /github/i },
    { label: 'Google', pattern: /google/i },
  ];

  for (const { label, pattern } of providers) {
    const control = page.getByRole('button', { name: pattern }).or(page.getByRole('link', { name: pattern }));
    await expect(control.first(), `Expected a visible button/link matching ${label} on /login`).toBeVisible();
  }
});

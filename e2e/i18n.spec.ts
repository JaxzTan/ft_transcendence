import { test, expect, type Page } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

// nginx fronts /api/auth/login with a strict zone (rate=5r/m, burst=5, nodelay — see
// nginx/conf/nginx.conf) that returns a flat 503 once exhausted, independent of the
// backend's own @Throttle. This suite logs in several times per file, so logins are
// paced to stay under that budget, with one reactive retry as a safety net.
let lastLoginAt = 0;
const LOGIN_SPACING_MS = 13_000;

async function rateLimitedLogin(page: Page, identifier: string, password: string) {
  const wait = lastLoginAt + LOGIN_SPACING_MS - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  lastLoginAt = Date.now();
  try {
    await loginViaUi(page, identifier, password);
  } catch (err) {
    // Someone else's burst (another spec file, another worker) may have exhausted the
    // bucket right before ours — cool down longer and retry once.
    await page.waitForTimeout(20_000);
    lastLoginAt = Date.now();
    await loginViaUi(page, identifier, password);
  }
}

// Authenticated route list, from e2e/DISCOVERED.md §2.5 (FULL_ROUTES minus PUBLIC_ROUTES).
const AUTH_ROUTES = [
  '/home',
  '/leaderboard',
  '/friends',
  '/profile',
  '/gamelobby',
  '/gamelobby/table',
  '/game',
];

// The three locales actually shipped, per e2e/DISCOVERED.md §6 (frontend/src/i18n.ts
// resources: { en, ms, fr }) — NOT the en/zh/ms the docs claim.
const SHIPPED_LOCALES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'fr', label: 'Français' },
];

/** Maps a menuitemradio's visible label text to a locale code, for I18N-00. */
function labelToCode(label: string): string | null {
  const l = label.toLowerCase();
  if (l.includes('english')) return 'en';
  if (l.includes('bahasa melayu') || l.includes('melayu')) return 'ms';
  if (l.includes('français') || l.includes('francais')) return 'fr';
  if (l.includes('中文') || l.includes('chinese') || l.includes('mandarin')) return 'zh';
  return null;
}

/**
 * Navigates to an authenticated route, tolerating the RT-09 false-logout defect:
 * nginx's `auth` zone (rate=10r/m) fronts /api/auth/me, which every full page
 * navigation re-fires on mount. A route-sweep test firing many page.goto() calls
 * back-to-back can trip that limiter, and frontend/src/store.tsx treats the
 * resulting 429 as "not logged in", bouncing to /login. That's RT-09's bug, not
 * whatever this test is checking — so detect the bounce and retry once after a
 * cool-down rather than let it masquerade as this test's own failure.
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

// CORRECTION to e2e/DISCOVERED.md §6: that discovery pass read AccountMenu.tsx
// (aria-label="Account menu", role="menuitemradio" items) but that component is
// NOT what's actually rendered — the live Shell layout renders
// RetroNavbar.tsx instead: a real <button id="userAccountBtn"
// aria-label="Account Settings, Language and 2FA">, whose popover
// (#accountPopoverMenu, toggled via a CSS `active` class / display:flex, no
// aria-expanded at all) contains plain <button>s labelled "EN"/"MS"/"FR",
// not role="menuitemradio". Confirmed directly from a live accessibility
// snapshot during test development, not from source alone.
async function openAccountMenu(page: Page) {
  const btn = page.getByRole('button', { name: 'Account Settings, Language and 2FA' });
  await expect(btn, 'Account menu trigger not found — are we still authenticated (not bounced to /login)?').toBeVisible({
    timeout: 15_000,
  });
  const menu = page.locator('#accountPopoverMenu');
  if (!(await menu.evaluate((el) => el.classList.contains('active')))) {
    await btn.click();
  }
  await expect(menu).toBeVisible();
}

const LANG_BUTTON_TEXT: Record<string, string> = { English: 'EN', 'Bahasa Melayu': 'MS', Français: 'FR' };

/**
 * Opens the account menu and picks a language by its visible label.
 * The account menu only exists inside the `Shell` layout (header), which /game,
 * /gamelobby and /gamelobby/table do NOT use — so this always routes through
 * /home first to guarantee the menu is reachable regardless of where the caller
 * left off in a route-iteration loop.
 */
async function switchLocale(page: Page, label: string) {
  await gotoAuthed(page, '/home');
  await openAccountMenu(page);
  const short = LANG_BUTTON_TEXT[label] ?? label;
  await page
    .locator('#accountPopoverMenu div[style*="repeat(3, 1fr)"] button', { hasText: short })
    .first()
    .click();
  // setLang() doesn't close the popover itself (unlike the old AccountMenu.tsx
  // assumption) -- close it explicitly so later gotoAuthed() navigations don't
  // leave it hanging open.
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Account Settings, Language and 2FA' }).click();
}

// Pattern from BRIEF.md I18N-01: dot-separated identifier, e.g. "profile.achievementsTab".
const KEY_PATTERN = /\b[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*){1,4}\b/g;
const TLD_OR_EXT =
  /\.(com|net|org|io|dev|co|app|gov|edu|png|jpg|jpeg|svg|gif|ico|css|js|ts|tsx|jsx|json|html|htm|pdf|xml|txt|woff|woff2|ttf|map|ico)$/i;

/** Scans text for unresolved-looking i18next keys, excluding emails and TLD/extension-like matches. */
function findSuspiciousKeys(text: string): string[] {
  const found: string[] = [];
  const re = new RegExp(KEY_PATTERN);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const match = m[0];
    const start = m.index;
    const end = start + match.length;
    const prevChar = start > 0 ? text[start - 1] : '';
    const nextChar = end < text.length ? text[end] : '';
    if (prevChar === '@' || nextChar === '@') continue; // part of an email address
    if (TLD_OR_EXT.test(match)) continue; // looks like a domain/filename, not a key
    found.push(match);
  }
  return found;
}

test('I18N-00 @defect switcher offers the documented locale set (en/zh/ms)', async ({ page }) => {
  test.setTimeout(90_000);
  await rateLimitedLogin(page, 'Alice', 'password');
  await openAccountMenu(page);

  // Scoped to the 3-column language grid specifically, not the whole popover
  // (which also contains a logout <button> that would otherwise pollute this).
  const items = page.locator('#accountPopoverMenu div[style*="repeat(3, 1fr)"] button');
  const count = await items.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push((await items.nth(i).innerText()).trim());
  }
  const offeredCodes = new Set(labels.map(labelToCode).filter((c): c is string => c !== null));
  const documented = ['en', 'zh', 'ms'];
  const missing = documented.filter((c) => !offeredCodes.has(c));

  expect(
    missing,
    `Switcher must offer ${documented.join(', ')} per the docs. Found labels: [${labels.join(', ')}] ` +
      `(resolved codes: [${[...offeredCodes].join(', ')}]). Missing: [${missing.join(', ')}].`,
  ).toEqual([]);
});

test('I18N-01 no raw translation keys leak on any authenticated route, any locale', async ({ page }) => {
  test.setTimeout(300_000);
  await rateLimitedLogin(page, 'Alice', 'password');

  const leaks: string[] = [];

  for (const locale of SHIPPED_LOCALES) {
    await switchLocale(page, locale.label);

    for (const route of AUTH_ROUTES) {
      await gotoAuthed(page, route);
      await page.waitForTimeout(300);
      const text = await page.evaluate(() => document.body.innerText);
      const suspicious = findSuspiciousKeys(text);
      for (const key of suspicious) {
        leaks.push(`[${locale.code}] ${route} — "${key}"`);
      }
    }
  }

  // NOTE: BRIEF.md's known I18N-01 failure is in backend-generated email templates
  // (password reset / verification emails), which a browser test can never reach —
  // a clean pass here only covers the frontend SPA surface, not that known gap.
  expect(leaks, `Raw/unresolved translation keys found:\n${leaks.join('\n')}`).toEqual([]);
});

test('I18N-02 @defect locale preference survives a storage wipe (should be server-side)', async ({ page }) => {
  test.setTimeout(90_000);
  await rateLimitedLogin(page, 'Alice', 'password');
  await switchLocale(page, 'Bahasa Melayu');

  // Sanity: confirm the switch actually took effect before wiping storage.
  await expect(page.locator('body')).toContainText('Laman Utama', { timeout: 5000 });

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  const bodyText = await page.evaluate(() => document.body.innerText);
  const stillMs = bodyText.includes('Laman Utama');

  expect(
    stillMs,
    `Expected locale to persist as 'ms' (sidebar nav should still read "Laman Utama") after a ` +
      `localStorage/sessionStorage wipe + reload, since the preference should live against the user ` +
      `record server-side. Got reverted to another locale instead — body contains "Home"? ` +
      `${bodyText.includes('Home')}. This confirms i18n is localStorage-only with no server-side field.`,
  ).toBe(true);
});

test('I18N-03 no horizontal overflow at 320x720, any locale x route', async ({ page }) => {
  test.setTimeout(300_000);
  // NOTE: RetroNavbar.tsx's #accountPopoverMenu is positioned
  // `left: calc(100% + 14px)` with no narrow-viewport repositioning, so at
  // 320px width it renders entirely outside the viewport and switchLocale()
  // can never click into it -- confirmed via a real timeout ("element is
  // outside of the viewport", 400+ retries) when this test tried to switch
  // locale while already at 320x720. That's itself a real responsive-layout
  // finding, but it's outside I18N-03's own scope (overflow, not
  // reachability), so work around it here: switch locale at a normal
  // desktop width, THEN narrow to 320x720 only to measure overflow.
  await rateLimitedLogin(page, 'Alice', 'password');

  const overflows: string[] = [];

  for (const locale of SHIPPED_LOCALES) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await switchLocale(page, locale.label);
    await page.setViewportSize({ width: 320, height: 720 });

    for (const route of AUTH_ROUTES) {
      await gotoAuthed(page, route);
      await page.waitForTimeout(300);
      const diff = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (diff > 2) {
        overflows.push(`[${locale.code}] ${route} — scrollWidth-clientWidth=${diff}px`);
      }
    }
  }

  expect(
    overflows,
    `Horizontal overflow (>2px) found at 320x720:\n${overflows.join('\n')}`,
  ).toEqual([]);
});

test('I18N-04 missing translation key falls back instead of rendering the raw key', async ({ page }) => {
  test.setTimeout(90_000);
  await rateLimitedLogin(page, 'Alice', 'password');

  // frontend/src/i18n.ts does not attach the i18next instance to `window` anywhere
  // (grepped the whole frontend/src tree for window.i18n / window.i18next — no hits).
  // Per BRIEF.md I18N-04, if it isn't exposed we skip rather than fabricate a DOM substitute.
  const exposed = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return typeof w.i18n !== 'undefined' || typeof w.i18next !== 'undefined';
  });

  test.skip(
    !exposed,
    'i18next is not exposed on window (confirmed by reading frontend/src/i18n.ts and grepping ' +
      'frontend/src for window.i18n / window.i18next — no attachment exists). Per BRIEF.md, skip ' +
      'rather than fabricate a DOM-based substitute for I18N-04.',
  );

  const result = await page.evaluate(() => {
    const w = window as unknown as { i18n?: { t: (k: string) => string }; i18next?: { t: (k: string) => string } };
    const inst = w.i18n ?? w.i18next;
    return inst!.t('this.key.definitely.does.not.exist');
  });

  expect(result, `Expected a missing-key fallback, but got the raw key back: "${result}"`).not.toBe(
    'this.key.definitely.does.not.exist',
  );
});

/**
 * Pre-release smoke test.
 *
 * Drives a real browser over every screen an agency or a traveller actually
 * opens, plus the walkthrough end to end. It exists because the walkthrough
 * shipped with a bug — pressing Next reloaded the page — that no unit test could
 * have caught and that a single click would have.
 *
 * Usage:
 *   npm run build
 *   JWT_SECRET=local-development-secret-at-least-32-chars npx next start
 *   npm run smoke                                   # in another terminal
 *
 * It needs no database. A Control agency resolves entirely from its own session
 * claims (see resolvePortalAgency), and the traveller app falls back to a demo
 * booking when nobody is signed in — so a local server with nothing behind it
 * is enough to exercise every screen. The agency session is minted here against
 * the local dev JWT_SECRET: a local key, for a local server, granting nothing
 * anywhere else.
 *
 * Lists will be empty (they need the database) so this checks screens render,
 * not that they render data.
 */
import { chromium } from 'playwright-core';
import { SignJWT } from 'jose';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SECRET = process.env.JWT_SECRET || 'local-development-secret-at-least-32-chars';

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push(detail ? `${name} — ${detail}` : name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function agencyCookie() {
  const token = await new SignJWT({
    kind: 'agency',
    agencyId: 'recRA6kkeuHKY7acT',
    email: 'you@youragency.co.uk',
    source: 'control',
    agencyName: 'Your Travel Co',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(SECRET));
  return { name: 'lt_agency_session', value: token, domain: 'localhost', path: '/' };
}

/** next/image lazy-loads, so nothing below the fold is fetched until you scroll. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
}

const PORTAL_PAGES = [
  ['/agency', 'Quick actions'],
  ['/agency/guide', 'Setting up, step by step'],
  ['/agency/access', 'Send app access'],
  ['/agency/branding', 'App branding'],
  ['/agency/settings', 'Settings'],
  ['/agency/travellers', 'Travellers'],
  ['/agency/documents', 'Documents'],
  ['/agency/messages', 'Messages'],
];

const TRAVELLER_PAGES = [
  ['/?demo=DEMO81297', 'Maldives'],
  ['/itinerary', 'Itinerary'],
  ['/documents', 'Documents'],
  ['/destination', ''],
  ['/luna', ''],
  ['/me', ''],
];

async function main() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const jsErrors = [];

  // ── The portal ────────────────────────────────────────────────────────────
  const desk = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await desk.addCookies([await agencyCookie()]);
  // Suppress the walkthrough for the page checks; it gets its own section below.
  await desk.addInitScript(() => {
    try {
      window.localStorage.setItem('luna-travel.tour.agency.seen', '1');
    } catch {
      /* nothing to suppress */
    }
  });

  for (const [path, expected] of PORTAL_PAGES) {
    const page = await desk.newPage();
    page.on('pageerror', (e) => jsErrors.push(`${path}: ${e.message}`));
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const body = (await page.textContent('body').catch(() => '')) || '';
    check(`portal ${path}`, res.status() === 200 && body.includes(expected), String(res.status()));
    await page.close();
  }

  // Every screenshot the guide promises actually resolves.
  const guide = await desk.newPage();
  await guide.goto(`${BASE}/agency/guide`, { waitUntil: 'domcontentloaded' });
  await guide.waitForTimeout(2000);
  await scrollThrough(guide);
  const imgs = await guide.$$eval('img', (els) => els.map((e) => e.naturalWidth));
  check(
    'guide screenshots all load',
    imgs.length >= 6 && imgs.every((w) => w > 0),
    `${imgs.filter((w) => w > 0).length}/${imgs.length}`,
  );
  await guide.close();

  // ── The walkthrough ───────────────────────────────────────────────────────
  const tourCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await tourCtx.addCookies([await agencyCookie()]);
  const page = await tourCtx.newPage();
  page.on('pageerror', (e) => jsErrors.push(`tour: ${e.message}`));
  await page.goto(`${BASE}/agency`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const dialog = page.getByRole('dialog');
  check('walkthrough auto-starts on a first visit', await dialog.isVisible().catch(() => false));

  const startUrl = page.url();
  const label = (await page.locator('text=/Step \\d+ of \\d+/').textContent().catch(() => '')) || '';
  const total = Number(label.match(/of (\d+)/)?.[1] || 0);
  check('step counter reads sensibly', total > 3, label);

  let navigated = false;
  let scrollJumps = 0;
  let spotlit = 0;

  for (let i = 1; i < total; i += 1) {
    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.waitForTimeout(650);

    if (page.url() !== startUrl) {
      navigated = true;
      break;
    }
    const after = await page.evaluate(() => window.scrollY);
    if (Math.abs(after - before) > 40) scrollJumps += 1;

    // The spotlight is the fixed element carrying the giant ring shadow.
    const lit = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((d) => {
        const s = getComputedStyle(d);
        return s.position === 'fixed' && s.boxShadow.includes('9999px');
      }),
    );
    if (lit) spotlit += 1;
  }

  // THE regression. Navigating remounts the portal shell, which reads to an
  // agent as the tour reloading the site under them.
  check('Next never changes the page', !navigated);
  check('Next never jumps the scroll', scrollJumps === 0, `${scrollJumps} jump(s)`);
  check('steps spotlight a real control', spotlit >= total - 3, `${spotlit}/${total - 1} lit`);

  const finish = page.getByRole('button', { name: /^Finish$/ });
  check('the last step offers Finish', await finish.isVisible().catch(() => false));
  await finish.click().catch(() => {});
  await page.waitForTimeout(600);
  check('finishing closes it', !(await dialog.isVisible().catch(() => false)));

  const launcher = page.getByRole('button', { name: /Show me how/i });
  check('the launcher comes back', await launcher.isVisible().catch(() => false));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  check('it does not run again once seen', !(await dialog.isVisible().catch(() => false)));

  await page.getByRole('button', { name: /Show me how/i }).click();
  await page.waitForTimeout(700);
  check('the launcher replays it', await dialog.isVisible().catch(() => false));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Escape always gets you out', !(await dialog.isVisible().catch(() => false)));
  await page.close();

  // ── The traveller app ─────────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const [path, expected] of TRAVELLER_PAGES) {
    const p = await phone.newPage();
    p.on('pageerror', (e) => jsErrors.push(`${path}: ${e.message}`));
    const res = await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2000);
    const body = (await p.textContent('body').catch(() => '')) || '';
    check(
      `traveller ${path}`,
      res.status() === 200 && (!expected || body.includes(expected)),
      String(res.status()),
    );
    await p.close();
  }

  check('no uncaught JavaScript anywhere', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));

  await browser.close();

  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  if (fail.length) {
    console.log('FAILURES:');
    for (const f of fail) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[smoke] run threw:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

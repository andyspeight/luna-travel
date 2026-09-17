/**
 * Screenshots for the agency guide.
 *
 * The guide tells an agency what their travellers will see, and what they
 * themselves have to fill in. Describing that in words is weak when we can
 * simply show it — so this drives a real browser at a real running app and
 * captures the screens: the traveller app on a phone, the portal on a desk.
 *
 * REAL SCREENS, NOT MOCK-UPS. The traveller app falls back to a demo booking
 * when nobody is signed in, so these are the genuine pages with genuine layout.
 * A drawing of a screen drifts from the product the first time somebody moves a
 * button; a screenshot you can regenerate does not.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run guide:shots    # in another
 *
 * Portal screens need a signed-in agency, so this mints one against the local
 * dev JWT_SECRET. Only the two the guide's setup steps talk about are taken:
 * the rest of the portal is a list that is empty without a database, and an
 * agent reading the guide is already looking at the real thing anyway.
 */
import { chromium } from 'playwright-core';
import { SignJWT } from 'jose';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/guide');
const BASE = process.env.SHOT_BASE_URL || 'http://localhost:3000';

// Playwright's own chromium, already on the image. No download.
const EXECUTABLE =
  process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** A phone, because that is the only way a traveller ever sees the app. */
const PHONE = { width: 390, height: 844 };
/** The portal is a desk tool. Its content is capped at 760, so this frames it. */
const DESK = { width: 1000, height: 860 };

/**
 * A local agency session, so the portal screens can be captured at all.
 *
 * Signed with the dev JWT_SECRET this server was started with — it is a local
 * key for a local server and grants nothing anywhere else. A Control agency
 * resolves entirely from its own claims (see resolvePortalAgency), so the
 * portal renders with no database behind it, which is why this works.
 */
async function agencyCookie() {
  const raw = process.env.JWT_SECRET || 'local-development-secret-at-least-32-chars';
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
    .sign(new TextEncoder().encode(raw));

  return { name: 'lt_agency_session', value: token, domain: 'localhost', path: '/' };
}

/**
 * `then` clicks a link once `path` has loaded, for a screen that needs another
 * one visited first.
 *
 * NOT the trip home. `/` deliberately shows the "add your trip" onboarding
 * until a real booking has loaded — a signed session alone is not enough, it
 * wants a booking it can actually fetch. Capturing it needs an environment with
 * a reachable booking behind it, so it is left out rather than shipped as a
 * screenshot of the empty state pretending to be a trip.
 */
const SHOTS = [
  // The trip home. ?demo= is the app's own demo deep-link (the TravelTech Show
  // path), which is what makes this capturable: loaded plain, `/` shows the
  // "add your trip" onboarding until a real booking has resolved.
  { path: '/?demo=DEMO81297', file: 'traveller-home.png', wait: 2600 },
  { path: '/itinerary', file: 'traveller-itinerary.png', wait: 1800 },
  { path: '/documents', file: 'traveller-documents.png', wait: 1800 },
  { path: '/destination', file: 'traveller-destination.png', wait: 2400 },

  // The two portal screens the guide's setup steps talk about. The rest of the
  // portal is not worth a picture: an agent reading this is already looking at
  // it, and its lists are empty without a database behind them.
  { path: '/agency/branding', file: 'portal-branding.png', wait: 2600, desk: true },
  { path: '/agency/access', file: 'portal-access.png', wait: 2200, desk: true },
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  const desk = await browser.newContext({ viewport: DESK, deviceScaleFactor: 2 });
  await desk.addCookies([await agencyCookie()]);
  // Mark the walkthrough as already seen, or it auto-starts on a fresh browser
  // and every portal screenshot is of its welcome card.
  await desk.addInitScript(() => {
    try {
      window.localStorage.setItem('luna-travel.tour.agency.seen', '1');
    } catch {
      /* nothing to suppress if storage is unavailable */
    }
  });

  let failed = 0;
  for (const shot of SHOTS) {
    const url = `${BASE}${shot.path}`;
    const page = await (shot.desk ? desk : phone).newPage();
    try {
    // domcontentloaded, NOT networkidle: these screens poll for messages and
    // flight status, so the network is never idle and every shot would sit out
    // its full timeout before capturing exactly the same thing.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (shot.then) {
      await page.waitForTimeout(1200);
      await page.locator(`a[href="${shot.then}"]`).first().click({ timeout: 8_000 });
    }
    // Let entrance animations finish, or every shot is a half-faded page.
    await page.waitForTimeout(shot.wait);
      const file = join(OUT, shot.file);
      await page.screenshot({ path: file });
      console.log(`[guide:shots] ${shot.path} -> public/guide/${shot.file}`);
    } catch (e) {
      failed += 1;
      console.error(`[guide:shots] ${shot.file} FAILED:`, e instanceof Error ? e.message : e);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[guide:shots] failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

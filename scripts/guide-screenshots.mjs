/**
 * Screenshots for the agency guide.
 *
 * The guide tells an agency what their travellers will see. Describing that in
 * words is weak when we can simply show it — so this drives a real browser at a
 * real running app and captures the traveller screens at phone size.
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
 * Only the traveller side is captured. The portal needs a signed-in agency, and
 * a screenshot of a portal the agent is already looking at teaches nobody
 * anything — that is what the walkthrough is for.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/guide');
const BASE = process.env.SHOT_BASE_URL || 'http://localhost:3000';

// Playwright's own chromium, already on the image. No download.
const EXECUTABLE =
  process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** A phone, because that is the only way a traveller ever sees this. */
const VIEWPORT = { width: 390, height: 844 };

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
  { path: '/itinerary', file: 'traveller-itinerary.png', wait: 1800 },
  { path: '/documents', file: 'traveller-documents.png', wait: 1800 },
  { path: '/destination', file: 'traveller-destination.png', wait: 2400 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

  let failed = 0;
  for (const shot of SHOTS) {
    const url = `${BASE}${shot.path}`;
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
    }
  }

  await browser.close();
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[guide:shots] failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

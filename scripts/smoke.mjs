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
import { audit, describeFailures } from './accessibility.mjs';

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
  ['/essentials', 'Trip essentials'],
  ['/itinerary', 'Itinerary'],
  ['/documents', 'Documents'],
  ['/destination', ''],
  ['/luna', ''],
  ['/me', ''],
  // The detail screens, which this used to skip. Every one of them shows a
  // weekday, and a weekday rendered one way on the server and another in the
  // browser made React throw the whole tree away and re-render it — an
  // uncaught error on every visit that nothing here was open to see.
  ['/flight/f1', ''],
  ['/hotel/h1', ''],
  ['/extra/x1', ''],
  ['/help', ''],
];

async function main() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const jsErrors = [];

  // ── The portal ──────────────────────────────────────────────────────
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

  // ── The walkthrough ────────────────────────────────────────────────
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

  // ── The traveller app ──────────────────────────────────────────────
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

  // ── Trip essentials ────────────────────────────────────────────────
  //
  // The utilities screen, exercised rather than just loaded. A rate is seeded
  // into storage first: the FX provider is not reachable from CI, and the
  // saved-rate path is the offline behaviour this screen promises, so proving
  // that is worth more than proving a live call.
  const util = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await util.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'luna-travel.fx.GBP.MVR',
        JSON.stringify({ rate: 19.42, asOf: '2026-09-15T00:00:02Z', fetchedAt: '2026-09-15T08:00:00Z' }),
      );
    } catch {
      /* private window — the rest of the screen still renders */
    }
  });
  const ess = await util.newPage();
  ess.on('pageerror', (e) => jsErrors.push(`essentials: ${e.message}`));
  await ess.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await ess.waitForTimeout(2500);
  await ess.goto(`${BASE}/essentials`, { waitUntil: 'domcontentloaded' });
  await ess.waitForTimeout(3000);

  const essBody = (await ess.textContent('body')) || '';
  check('the packing list is built from the trip', /Packing list/.test(essBody) && /Passport/.test(essBody));
  check('a saved rate converts with no network', /19\.42/.test(essBody));
  check('and says it is a saved copy', /saved copy/.test(essBody));

  const amountField = ess.getByLabel(/Amount in pounds/i).first();
  if (await amountField.count()) {
    await amountField.fill('25');
    await ess.waitForTimeout(500);
    check('the converter converts', /485\.50/.test((await ess.textContent('body')) || ''));
  } else {
    check('the converter converts', false, 'no amount field');
  }

  // THE regression: one tel: link over "102 (police) · 119 (medical)" dialled
  // 102119, which is not a number anywhere.
  const dials = await ess.$$eval('a[href^="tel:"]', (els) => els.map((e) => e.getAttribute('href')));
  check('each emergency service dials its own number', dials.includes('tel:102') && dials.includes('tel:119'), dials.join(' '));

  const tickable = ess.locator('[aria-pressed]');
  if (await tickable.count()) {
    await tickable.first().click();
    await ess.waitForTimeout(400);
    await ess.reload({ waitUntil: 'domcontentloaded' });
    await ess.waitForTimeout(2500);
    check('a ticked item stays ticked', (await ess.locator('[aria-pressed="true"]').count()) === 1);
  } else {
    check('a ticked item stays ticked', false, 'nothing tickable');
  }
  await ess.close();

  // ── The admin dead end ──
  //
  // Admin pages stopped being gated in the SSO migration, on the understanding
  // that a client-side tg-auth-gate.js would take over. It was never added, so
  // the shell rendered for anyone, every API answered 401, and the only button
  // on screen re-ran the same doomed request. Somebody hit that two weeks
  // running. These guard the way out.
  const gateCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  let bounced = null;
  await gateCtx.route('**://id.travelify.io/**', (route) => {
    bounced = route.request().url();
    route.abort();
  });
  const gp = await gateCtx.newPage();
  await gp.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await gp.waitForTimeout(3500);

  check('a signed-out admin is sent to Travelgenix ID', !!bounced && bounced.includes('/signin'), String(bounced).slice(0, 60));
  check(
    'and is brought back to the page they wanted',
    !!bounced && decodeURIComponent(String(bounced)).includes('/admin/dashboard'),
  );

  // Bouncing twice is an infinite loop nobody can read their way out of.
  bounced = null;
  await gp.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await gp.waitForTimeout(3000);
  const gateBody = (await gp.textContent('body')) || '';

  check('a second visit does not bounce again', bounced === null);
  check('it offers a sign-in button instead', /Sign in/.test(gateBody));
  check('the unusable admin shell is gone', !/Sync monitor/.test(gateBody));
  check('and the misleading expiry message with it', !/session has expired/.test(gateBody));
  await gp.close();

  // ── The demo landing page ──
  //
  // This is the page a prospect opens first, so its failure mode is a
  // beautiful page whose links go nowhere. Checked in a real browser because
  // the QR codes are generated client-side and a unit test cannot see them.
  const demoCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await demoCtx.newPage();
  dp.on('pageerror', (e) => jsErrors.push(`demo: ${e.message}`));
  const demoRes = await dp.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' });
  await dp.waitForTimeout(3000);

  const demoBody = (await dp.textContent('body')) || '';
  check('the demo page loads', demoRes.status() === 200, String(demoRes.status()));
  check(
    'all four trips are offered',
    ['Maldives', 'Athens', 'Dubai', 'Mallorca'].every((d) => demoBody.includes(d)),
  );

  // Generated client-side from window.location.origin, so they only exist in
  // a real browser.
  const qrCount = await dp.$$eval('img[src^="data:image"]', (els) => els.length);
  check('a QR code is generated for each trip', qrCount === 4, `${qrCount} of 4`);

  const broken = await dp.$$eval('img', (els) => els.filter((e) => e.naturalWidth === 0).length);
  check('every photograph and screenshot loads', broken === 0, `${broken} broken`);

  // The traveller nav belongs to a trip. On a page sent to somebody with no
  // trip it reads as chrome for an app they have not opened.
  check('the traveller tab bar is hidden', !/Itinerary/.test(demoBody) || !/Docs/.test(demoBody));

  // A desktop reader is pointed at the QR codes before anything else, and the
  // browser link must not look like the way in. The page must also not go on
  // claiming desktop looks broken now that a trip opened here is framed at
  // phone size — an untrue warning on a sales page costs more than it saves.
  const scanNotice = dp.getByText('Built for a phone.', { exact: false }).first();
  check('desktop is told to scan first', await scanNotice.isVisible().catch(() => false));
  check('and told what the browser gives instead', /framed at phone size/i.test(demoBody));
  check('no stale warning that desktop looks broken', !/stretched/i.test(demoBody));

  const desktopButton = await dp.getByRole('link', { name: /^Open this trip$/ }).count();
  const visibleButton = desktopButton
    ? await dp.getByRole('link', { name: /^Open this trip$/ }).first().isVisible()
    : false;
  check('the big Open button is not offered on desktop', !visibleButton);

  // THE check: the links must actually reach a working trip, whichever the
  // reader takes.
  const escape = dp.getByRole('link', { name: /Open in this browser instead/ }).first();
  const tripHref = await escape.getAttribute('href');
  check('a trip link points at a demo booking', /\?demo=DEMO\d+/.test(tripHref || ''), tripHref || 'none');

  await escape.click();
  await dp.waitForTimeout(3000);
  const landed = (await dp.textContent('body')) || '';
  check('and opens the real app on that trip', /Maldives/.test(landed) && !/Pick one/.test(landed));
  await dp.close();

  // On a phone the QR is a picture of a URL you cannot use, so the button
  // leads there instead — the mirror image of the rule above.
  const demoPhone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await demoPhone.newPage();
  mp.on('pageerror', (e) => jsErrors.push(`demo-mobile: ${e.message}`));
  await mp.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' });
  await mp.waitForTimeout(2500);

  check(
    'a phone gets the button, not a QR code',
    await mp.getByRole('link', { name: /^Open this trip$/ }).first().isVisible(),
  );
  // Hidden with CSS rather than unmounted, so this has to ask about
  // visibility — textContent happily returns text nobody can see.
  const phoneNotice = mp.getByText('Built for a phone.', { exact: false }).first();
  check('and is not told to scan', !(await phoneNotice.isVisible().catch(() => false)));
  await mp.close();

  // ── A demo link must win over a live booking ──
  //
  // The provider replaces a demo trip with the traveller's real booking on
  // every load, so that a real traveller never falls back to a demo. The rule
  // was too broad: anyone who had ever redeemed a booking found every demo
  // link silently showing them their own trip instead — which is every agent
  // who tries the product before demonstrating it, and is how this was found.
  const liveCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await liveCtx.route('**/api/traveller/booking*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ booking: { reference: 'LIVE-0001', destinationLabel: 'Cyprus' } }),
    });
  });
  const lp = await liveCtx.newPage();
  await lp.goto(`${BASE}/?demo=DEMO52188`, { waitUntil: 'domcontentloaded' });
  await lp.waitForTimeout(4000);
  const withLive = (await lp.textContent('body')) || '';

  check(
    'an explicit demo link is not overridden by a live booking',
    /DEMO52188/.test(withLive) && !/LIVE-0001/.test(withLive),
  );
  await lp.close();

  // ── Documents, with the network off ──
  //
  // The promise the whole app leans on for a travel day. It used to be a
  // claim and nothing more: the screen printed "All saved on this device"
  // with nothing checking, and the service worker had no rule for a PDF or
  // for the proxy that serves one — so a traveller landing with no signal
  // found an empty screen, having been told the opposite.
  //
  // Driven with the network genuinely cut rather than stubbed, because every
  // part of this (service worker, cache, navigation fallback) only exists in
  // a real browser.
  const offCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const op = await offCtx.newPage();
  op.on('pageerror', (e) => jsErrors.push(`offline: ${e.message}`));
  await op.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await op.waitForTimeout(2500);
  await op.goto(`${BASE}/documents`, { waitUntil: 'domcontentloaded' });
  // The service worker has to install and the documents have to be fetched.
  await op.waitForTimeout(9000);

  const cachedCount = await op.evaluate(async () => {
    try {
      return (await (await caches.open('traveller-documents')).keys()).length;
    } catch {
      return -1;
    }
  });
  check('documents are actually stored on the device', cachedCount > 0, `${cachedCount} cached`);

  const onlineHeader = (await op.textContent('body')) || '';
  check('and the screen says so only because they are', /saved on this phone/i.test(onlineHeader));

  // Now the part that matters.
  await offCtx.setOffline(true);
  await op.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await op.waitForTimeout(5000);
  const offlineBody = (await op.textContent('body').catch(() => '')) || '';

  check('the app opens with no network at all', offlineBody.length > 100);
  check(
    'the documents are still listed',
    /booking pack|ATOL|insurance|voucher|ticket/i.test(offlineBody),
  );

  const servedBytes = await op.evaluate(async () => {
    try {
      const c = await caches.open('traveller-documents');
      const keys = await c.keys();
      if (!keys.length) return 0;
      const r = await c.match(keys[0]);
      return r ? (await r.arrayBuffer()).byteLength : 0;
    } catch {
      return 0;
    }
  });
  check('and a document opens from the phone', servedBytes > 1000, `${Math.round(servedBytes / 1024)} KB`);
  await offCtx.setOffline(false);
  await op.close();

  // ── The travel day ──
  //
  // The whole point of the phase, and completely invisible in an ordinary run:
  // the demo trip leaves in November, so without faking the clock every one of
  // these screens looks identical and would regress in silence.
  //
  // The Maldives demo is four legs, two of them connections — the shape that
  // broke the first version of this, and the shape most long-haul bookings
  // actually have.
  async function homeAt(iso) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (iso) await ctx.clock.setFixedTime(new Date(iso));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => jsErrors.push(`travel-day: ${e.message}`));
    await page.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const card = page.locator('section', { hasText: /Open travel documents/ }).first();
    const out = {
      headline: ((await page.textContent('h1').catch(() => '')) || '').trim(),
      body: (await page.textContent('body')) || '',
      card: (await card.count()) ? ((await card.textContent()) || '').replace(/\s+/g, ' ') : '',
    };
    await ctx.close();
    return out;
  }

  // Six weeks out, the countdown and the cover photo still lead. A flight card
  // on the sofa in September would be the same mistake in reverse.
  const sofa = await homeAt(null);
  check('an ordinary day still leads with the countdown', /until you fly/i.test(sofa.body));
  check('and shows no flight card', sofa.card === '', sofa.card.slice(0, 40));

  // The morning of the flight.
  const dayOf = await homeAt('2026-11-27T09:00:00Z');
  check('the day you fly leads with the flight', /Flying to Maldives today/.test(dayOf.headline), dayOf.headline);
  check('the card carries the departure', /20:15/.test(dayOf.card) && /LGW/.test(dayOf.card));
  check('and the terminal the airline filed', /Terminal ?South/i.test(dayOf.card));
  // Rule 8, on the screen where getting it wrong sends somebody to the far end
  // of an airport: the demo has no gate, so no gate may appear.
  check('but never a gate nobody filed', !/\bGate\b/.test(dayOf.card));
  check('the countdown is gone', !/until you fly/i.test(dayOf.body));
  check('and the documents are one tap away', /Open travel documents/.test(dayOf.card));

  // Connecting in Abu Dhabi at nine, onward flight at ten. This showed the
  // ordinary home screen and no flight at all.
  const connecting = await homeAt('2026-11-28T09:00:00Z');
  check('a connection shows the onward leg, not the one just landed', /10:00/.test(connecting.card) && /MLE/.test(connecting.card), connecting.card.slice(0, 60));

  // The worst one. Home from Malé at 14:30; the app used to show the 21:15
  // connection out of Abu Dhabi, which is not a flight they can catch.
  const homeward = await homeAt('2026-12-04T06:00:00Z');
  check('flying home leads with the flight they must get to', /Flying home today/.test(homeward.headline), homeward.headline);
  check('which is the leg out of Malé, not the connection after it', /14:30/.test(homeward.card) && /MLE/.test(homeward.card), homeward.card.slice(0, 60));

  // tripEnd is the hotel checkout, hours before they leave. The trip is not
  // over while they are still in the air.
  const airborne = await homeAt('2026-12-04T15:00:00Z');
  check('the trip is not declared over mid-flight', /Flying home today/.test(airborne.headline), airborne.headline);

  // ── How current the flight information is ──
  //
  // The review's fourth point. The flight screen used to print a bare
  // "Updated 09:12" when it happened to have a timestamp and say nothing at
  // all otherwise, so a traveller could not tell working tracking from broken
  // tracking — and the home screen worded the same thing differently.
  //
  // The demo has no live feed, which is the case worth checking: the honest
  // answer is to say so, not to go quiet.
  const freshCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fp = await freshCtx.newPage();
  fp.on('pageerror', (e) => jsErrors.push(`freshness: ${e.message}`));
  await fp.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await fp.waitForTimeout(2500);
  const flightTile = fp.getByRole('link', { name: /Flights/ }).first();
  if (await flightTile.count()) {
    await flightTile.click();
    await fp.waitForTimeout(2500);
  }
  const flightBody = (await fp.textContent('body')) || '';
  check(
    'the flight screen never leaves the age of its information unsaid',
    /Updated \d{2}:\d{2}|Live updates not available|Waiting for the first update|Offline/.test(
      flightBody,
    ),
    (flightBody.match(/Updated \d{2}:\d{2}|Live updates not available|Waiting for the first update/) || ['none'])[0],
  );
  // Both screens are fed by one decision now, so they must say the same thing.
  check(
    'and says it the same way the home screen does',
    /Live updates not available for this flight/.test(flightBody),
  );
  // It used to promise this while fetching exactly once per mount.
  check('no claim to be checking when nothing is', !/checking again/i.test(flightBody));

  // The back bar floats over the hero and used to print straight across the
  // airline's name. Geometry, because it reads fine in the text.
  const overlap = await fp.evaluate(() => {
    const bar = document.querySelector('.absolute.top-0');
    const name = [...document.querySelectorAll('div')].find(
      (d) => d.className.includes('text-sm') && /Airways|Air|Etihad/.test(d.textContent || ''),
    );
    if (!bar || !name) return null;
    const a = bar.getBoundingClientRect();
    const b = name.getBoundingClientRect();
    return Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  });
  check(
    'the back bar does not print over the airline name',
    overlap !== null && overlap <= 0,
    overlap === null ? 'could not measure' : `${overlap}px overlap`,
  );
  await fp.close();
  await freshCtx.close();

  // ── Contrast and touch targets ──
  //
  // Measured, not reviewed. The first measurement found 151 pieces of text
  // below the contrast threshold and 31 controls under 44px — including
  // "Delayed" and "Cancelled" on the flight screen, which were the two words
  // a traveller most needs and the least legible things on it.
  //
  // None of that shows up in a diff, so it is checked here every run. The
  // backdrop comes from the page as drawn, because the app paints photographs
  // in sibling layers and a stylesheet cannot say what colour those are where
  // the text sits.
  const a11y = await audit({ browser });
  const a11yFails = describeFailures(a11y);
  const contrastFails = a11yFails.filter((l) => l.startsWith('contrast')).length;
  const targetFails = a11yFails.filter((l) => l.startsWith('target')).length;

  check(
    'every piece of text meets its contrast threshold',
    contrastFails === 0,
    contrastFails
      ? `${contrastFails} of ${a11y.text.length}: ${a11yFails.filter((l) => l.startsWith('contrast')).slice(0, 2).join(' | ')}`
      : `${a11y.text.length} measured`,
  );
  check(
    'every control is at least 44x44',
    targetFails === 0,
    targetFails
      ? `${targetFails} of ${a11y.targets.length}: ${a11yFails.filter((l) => l.startsWith('target')).slice(0, 2).join(' | ')}`
      : `${a11y.targets.length} measured`,
  );
  // A screen that failed to render measures as passing, because there is
  // nothing on it to fail. The count is the guard against that.
  check('and the audit actually saw the app', a11y.text.length > 250, `${a11y.text.length} nodes`);
  jsErrors.push(...a11y.jsErrors.map((e) => `a11y: ${e}`));

  // ── Getting hold of a human ──
  //
  // The review's sixth point. Support was reachable only if you knew to look
  // under "Me", and a phone number with no hours leaves somebody in an airport
  // unable to judge whether to wait or to use the out-of-hours line.
  //
  // The rule worth protecting is the one about not inventing a promise: an
  // agency that has stated no hours must produce a screen that says nothing
  // about timing, rather than a plausible "9 to 5".
  const helpCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hp = await helpCtx.newPage();
  hp.on('pageerror', (e) => jsErrors.push(`help: ${e.message}`));
  await hp.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await hp.waitForTimeout(2500);

  const homeBody = (await hp.textContent('body')) || '';
  check(
    'help is reachable from the screen the app opens on',
    /Help from Travelgenix/.test(homeBody),
  );

  await hp.goto(`${BASE}/help`, { waitUntil: 'domcontentloaded' });
  await hp.waitForTimeout(2500);
  const helpBody = (await hp.textContent('body')) || '';

  // Either state is correct — which one depends on when the suite runs — but
  // it must say one of them rather than showing a bare phone number.
  check(
    'it says whether anybody is there right now',
    /Open now · until \d{2}:\d{2}|Closed · opens/.test(helpBody),
    (helpBody.match(/Open now · until \d{2}:\d{2}|Closed · opens[^.]{0,28}/) || ['none'])[0],
  );
  // A traveller in the Maldives reading "opens at 09:00" would assume theirs.
  // No trailing word boundary: textContent runs this straight into the next
  // element, so the body reads "…17:30 BSTMessages answered…".
  check(
    'and whose clock that is on',
    /\d{2}:\d{2} (GMT|BST|UTC|GMT[+-]\d)/.test(helpBody),
    (helpBody.match(/\d{2}:\d{2} (?:GMT|BST|UTC|GMT[+-]\d)/) || ['none'])[0],
  );
  check('it states the reply promise', /answered within one working day/i.test(helpBody));
  check(
    'the out-of-hours number is on the screen, not buried',
    /Urgent, any time of day/.test(helpBody),
  );

  const emergency = hp.locator('a[href^="tel:"]').filter({ hasText: /Urgent/ }).first();
  check(
    'and it dials the emergency line rather than the office',
    ((await emergency.getAttribute('href').catch(() => '')) || '').includes('7700900900'),
  );

  // The rule about not inventing a promise for an agency that has stated
  // nothing is covered where it can actually be exercised — lib/__tests__/
  // support-hours, which drives the unset, empty and unparseable cases. It
  // cannot be reached from here, because the demo agency has hours.

  await hp.close();
  await helpCtx.close();

  // ── Booked versus suggested ──
  //
  // The review's third point. Suggestion tiles scroll past directly below
  // "Up next", which is the traveller's confirmed itinerary, and a tile
  // showing a photograph and "from £1,149" is the one thing on the home
  // screen that could be taken for something they have paid for.
  const bookedCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bp = await bookedCtx.newPage();
  bp.on('pageerror', (e) => jsErrors.push(`booked: ${e.message}`));
  await bp.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await bp.waitForTimeout(2500);
  await scrollThrough(bp);

  // Measured by geometry, not by textContent: a label squeezed to zero width
  // is invisible to a traveller and still reads as present in textContent.
  const cards = await bp.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button[aria-label^="Enquire about"]')) {
      const marked = [...el.querySelectorAll('span')].some(
        (x) => /^\s*Not booked\s*$/i.test(x.textContent || '') &&
          x.getBoundingClientRect().width > 8,
      );
      out.push({
        label: el.getAttribute('aria-label') || '',
        marked,
        money: ((el.textContent || '').match(/[£$€]\s?[\d,]+/g) || [])[0] || null,
      });
    }
    return out;
  });
  check('the home screen offers suggestions at all', cards.length > 0, `${cards.length} cards`);
  check(
    'every suggestion says it is not booked',
    cards.length > 0 && cards.every((c) => c.marked),
    `${cards.filter((c) => c.marked).length}/${cards.length}`,
  );

  // These cards used to print "from £1,149" — a number typed into a source
  // file, with no agency behind it, shown beside a traveller's real booking.
  // Nothing in the app can verify a price for a place nobody has quoted, so
  // no price may appear on one of these at all.
  const invented = cards.filter((c) => c.money);
  check(
    'and none of them quotes a price nobody can stand behind',
    invented.length === 0,
    invented.length ? invented.map((c) => `${c.label}: ${c.money}`).join(' | ') : 'no prices',
  );

  const homeText = (await bp.textContent('body')) || '';
  check(
    'and the section says so once as well',
    /nothing here is part of your booking/i.test(homeText),
  );

  // The counterpart: the screen that IS the booking says so.
  await bp.goto(`${BASE}/itinerary`, { waitUntil: 'domcontentloaded' });
  await bp.waitForTimeout(2200);
  const itinText = (await bp.textContent('body')) || '';
  check('the itinerary states that it is confirmed', /booked and confirmed/i.test(itinText));
  // And carries no suggestion, which is what made the reviewer worry.
  check('and mixes no suggestion into it', !/Not booked/i.test(itinText));

  await bp.close();
  await bookedCtx.close();

  // ── Allergies ──
  //
  // The Maldives demo has no phrase set (Dhivehi is not one of the twelve), so
  // this uses the Athens booking. Greek is the right one to check anyway: it
  // carries the warning about μαλάκια, which sits one slip from an insult.
  const allergy = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const alg = await allergy.newPage();
  alg.on('pageerror', (e) => jsErrors.push(`allergies: ${e.message}`));
  await alg.goto(`${BASE}/?demo=DEMO52188`, { waitUntil: 'domcontentloaded' });
  await alg.waitForTimeout(2500);
  await alg.goto(`${BASE}/essentials`, { waitUntil: 'domcontentloaded' });
  await alg.waitForTimeout(3000);

  const algBody = (await alg.textContent('body')) || '';
  check('the allergy picker appears for a supported language', /Allergies/.test(algBody));
  check(
    'all fourteen allergens are offered',
    /Peanuts/.test(algBody) && /Lupin/.test(algBody) && /Sulphites/.test(algBody),
  );

  // THE fix: a finished sentence, not a stem the traveller completes in
  // English. "Soy al\u00e9rgico a\u2026 peanuts" is the bug this closes.
  const molluscs = alg.getByRole('button', { name: 'Molluscs', exact: true });
  if (await molluscs.count()) {
    await molluscs.first().click();
    await alg.waitForTimeout(600);
    const picked = (await alg.textContent('body')) || '';
    check('picking one gives the whole sentence in Greek', /Έχω αλλεργία στα μαλάκια/.test(picked));
    check('and warns where the word is a slip from an insult', /θαλασσινά/.test(picked));
  } else {
    check('picking one gives the whole sentence in Greek', false, 'no allergen buttons');
  }
  await alg.close();

  // ── Ask Luna ─────────────────────────────────────────────────────
  //
  // Luna is a keyword router, not a model, so its failure mode is a question
  // landing in the wrong branch. These are the three that were landing wrong.
  const lunaPage = await util.newPage();
  lunaPage.on('pageerror', (e) => jsErrors.push(`luna: ${e.message}`));
  await lunaPage.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await lunaPage.waitForTimeout(2000);
  await lunaPage.goto(`${BASE}/luna`, { waitUntil: 'domcontentloaded' });
  await lunaPage.waitForTimeout(2000);

  const ask = async (question) => {
    const box = lunaPage.locator('input[aria-label="Ask Luna"]');
    await box.fill(question);
    await box.press('Enter');
    await lunaPage.waitForTimeout(1200);
    return (await lunaPage.textContent('body')) || '';
  };

  // Saying hello got "I can't answer that one for certain, and I'd rather not
  // guess" — before the traveller had asked anything.
  const hi = await ask('hello');
  check('Luna says hello back', /What can I help with for/.test(hi));

  // This was answered with passport VALIDITY rules. The expiry date is not the
  // problem when the passport is gone.
  const lost = await ask('I have lost my passport');
  check('a lost passport gets the embassy, not expiry rules', /embassy or consulate/.test(lost));

  // "How much is a taxi" was answered by naming the currency.
  // Answered from the booking on the device, not from a country list. These are
  // the questions that used to get the handoff while the answer sat in the app.
  const land = await ask('what time do we land?');
  check('Luna reads the flight off the booking', /EY20 lands at/.test(land), land.match(/EY\d+ lands at [^.]{0,30}/)?.[0] ?? '');
  check('and does not double the carrier code', !/EYEY/.test(land));

  const bags = await ask('how much luggage can I take?');
  check('Luna quotes the real baggage allowance', /23kg/.test(bags));

  const owed = await ask('how much do I still owe?');
  check('Luna reads the payment off the booking', /£6,240/.test(owed));

  // Every unanswerable question used to get the same shrug.
  const club = await ask('is there a kids club?');
  check('an unanswerable question is signposted, not shrugged', !/rather not guess/.test(club) && /to answer/.test(club));

  const cancelled = await ask('my flight is cancelled what do I do');
  check('a cancellation gets help, not a timetable', /airline desk/.test(cancelled));

  // Open-ended questions go to the model, which is NOT configured here. What
  // this checks is the failure path: the traveller gets the agent handoff
  // rather than a hang, an error, or an empty bubble.
  const open = await ask('what is there to do with teenagers on a wet afternoon?');
  check(
    'an open-ended question falls back gracefully with no model',
    /rather not guess/.test(open),
    open.length > 40 ? 'got a reply' : 'empty',
  );
  await lunaPage.close();

  // ── The flight-alert self-test must stay shut to the public ──
  //
  // It makes two real outbound requests every time it is called. An open door
  // here is a free traffic generator pointed at our own webhook.
  const selfTest = await browser.newPage();
  const gate = await selfTest.goto(`${BASE}/api/admin/flight-selftest`, { waitUntil: 'domcontentloaded' });
  check(
    'the flight self-test is shut without an admin session',
    gate.status() === 401 || gate.status() === 403 || gate.status() === 307,
    String(gate.status()),
  );
  await selfTest.close();

  // ── The file-removal job must refuse anyone without the secret ──
  //
  // It is the only thing in the system that destroys a customer's document.
  // An unauthenticated caller must get nowhere near it.
  const cleanup = await browser.newPage();
  const cleanupGate = await cleanup.goto(`${BASE}/api/cron/storage-cleanup?dryRun=1`, {
    waitUntil: 'domcontentloaded',
  });
  check(
    'the file-removal job refuses a caller with no secret',
    cleanupGate.status() === 401,
    String(cleanupGate.status()),
  );
  await cleanup.close();

  // ── The admin button must be shut to the public, POST most of all ──
  //
  // GET previews and POST destroys. An unauthenticated POST here would let
  // anyone on the internet clear a customer's documents.
  const adminCleanup = await browser.newPage();
  const previewGate = await adminCleanup.goto(`${BASE}/api/admin/storage-cleanup`, {
    waitUntil: 'domcontentloaded',
  });
  check(
    'the admin preview is shut without a session',
    [401, 403, 307].includes(previewGate.status()),
    String(previewGate.status()),
  );

  const postGate = await adminCleanup.evaluate(async (base) => {
    const r = await fetch(`${base}/api/admin/storage-cleanup`, { method: 'POST' });
    return r.status;
  }, BASE);
  check(
    'an unauthenticated POST cannot remove anything',
    [401, 403, 307].includes(postGate),
    String(postGate),
  );
  await adminCleanup.close();

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

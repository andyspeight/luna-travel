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
  ['/essentials', 'Trip essentials'],
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

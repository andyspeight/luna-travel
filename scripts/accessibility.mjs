/**
 * Contrast and touch targets, measured in a real browser.
 *
 * The review asked for these to be measured rather than estimated, and the
 * first measurement found 151 pieces of text below the threshold and 31
 * controls under 44px — including "Delayed" and "Cancelled" on the flight
 * screen, which were the least legible words on it.
 *
 * None of that was visible in code review, and none of it would stay fixed
 * without something that checks. So it runs with the smoke suite.
 *
 * The backdrop is taken from the page AS DRAWN, not from the stylesheet:
 * the app paints photographs and gradients in sibling layers, so walking the
 * DOM for a background colour gives the wrong answer on every hero and every
 * card. Instead the text is made invisible, the page is photographed, and the
 * median pixel behind each element is sampled.
 *
 * This measures the app as it ships. Whether an AGENCY's chosen colour stays
 * legible is proved separately and more thoroughly, in lib/__tests__/brand:
 * the readable shades are solved at runtime, so the sweep there checks every
 * 10 degrees of hue at five lightnesses against the real deriver — something
 * a browser run of one theme could never cover.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Every screen a traveller reaches. */
export const SCREENS = [
  ['/?demo=DEMO81297', 'Home'],
  ['/itinerary', 'Itinerary'],
  ['/documents', 'Documents'],
  ['/essentials', 'Essentials'],
  ['/flight/f1', 'Flight'],
  ['/hotel/h1', 'Hotel'],
  ['/extra/x1', 'Extra'],
  ['/destination', 'Destination'],
  ['/luna', 'Luna'],
  ['/me', 'Me'],
];

/* ── WCAG 2.2 maths ── */
const parse = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const luminance = ({ r, g, b }) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

/* ── in-page collectors ── */
const COLLECT_TEXT = () => {
  const ownText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2 || !ownText(el)) continue;

    let alpha = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(o) && o < 1) alpha *= o;
    }
    out.push({
      text: [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ').slice(0, 44),
      colour: cs.color,
      size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      weight: parseInt(cs.fontWeight, 10) || 400,
      alpha,
      x: b.x + window.scrollX,
      y: b.y + window.scrollY,
      w: b.width,
      h: b.height,
    });
  }
  return out;
};

const COLLECT_TARGETS = () => {
  const out = [];
  const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"]';
  for (const el of document.querySelectorAll(sel)) {
    if (el.hasAttribute('disabled')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    out.push({
      label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 38) || el.tagName,
      tag: el.tagName.toLowerCase(),
      w: Math.round(b.width),
      h: Math.round(b.height),
    });
  }
  return out;
};

const SAMPLE = async ({ png, items }) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = png;
  });
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);

  return items.map((it) => {
    const x = Math.max(0, Math.round(it.x));
    const y = Math.max(0, Math.round(it.y));
    const w = Math.min(Math.round(it.w), img.width - x);
    const h = Math.min(Math.round(it.h), img.height - y);
    if (w <= 0 || h <= 0 || y >= img.height) return { ...it, bg: null };
    const d = cx.getImageData(x, y, w, h).data;
    // Median per channel, so a gradient or a busy photograph still gives a
    // representative backdrop rather than being skewed by one bright corner.
    const R = [], G = [], B = [];
    const step = Math.max(1, Math.floor((w * h) / 4000));
    for (let i = 0; i < w * h; i += step) {
      R.push(d[i * 4]); G.push(d[i * 4 + 1]); B.push(d[i * 4 + 2]);
    }
    const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    return { ...it, bg: { r: med(R), g: med(G), b: med(B) } };
  });
};

/** Walk the app and measure it. */
export async function audit({ screens = SCREENS, browser: given } = {}) {
  const browser =
    given ||
    (await chromium.launch({
      executablePath: EXECUTABLE,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  await page.goto(`${BASE}/?demo=DEMO81297`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const text = [];
  const targets = [];

  for (const [path, name] of screens) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2400);

    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 110));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(700);

    for (const t of await page.evaluate(COLLECT_TARGETS)) {
      targets.push({ ...t, page: name, ok: t.w >= 44 && t.h >= 44 });
    }

    const items = await page.evaluate(COLLECT_TEXT);

    // Strip everything that is not backdrop, then photograph it.
    await page.addStyleTag({
      content: `*, *::before, *::after { color: transparent !important; text-shadow: none !important; }
                svg { visibility: hidden !important; }`,
    });
    await page.waitForTimeout(350);
    const png = 'data:image/png;base64,' + (await page.screenshot({ fullPage: true })).toString('base64');

    for (const s of await page.evaluate(SAMPLE, { png, items })) {
      if (!s.bg) continue;
      const fg = parse(s.colour);
      if (!fg) continue;
      const a = fg.a * s.alpha;
      const composited = {
        r: fg.r * a + s.bg.r * (1 - a),
        g: fg.g * a + s.bg.g * (1 - a),
        b: fg.b * a + s.bg.b * (1 - a),
      };
      const large = s.size >= 24 || (s.size >= 18.66 && s.weight >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(composited, s.bg);
      text.push({
        page: name,
        text: s.text,
        size: s.size,
        weight: s.weight,
        colour: s.colour,
        bg: `rgb(${s.bg.r}, ${s.bg.g}, ${s.bg.b})`,
        ratio: Math.round(got * 100) / 100,
        need,
        pass: got >= need,
      });
    }
  }

  await ctx.close();
  if (!given) await browser.close();
  return { text, targets, jsErrors };
}

/** One line per distinct failure, so a regression names itself. */
export function describeFailures({ text, targets }) {
  const lines = [];
  const seen = new Map();
  for (const t of text.filter((x) => !x.pass)) {
    const k = `${t.colour}|${t.size}|${t.weight}|${t.bg}`;
    if (!seen.has(k)) {
      seen.set(k, true);
      lines.push(
        `contrast ${t.ratio}:1 (need ${t.need}) ${t.size}px/${t.weight} ${t.colour} on ${t.bg} — ${t.page}: "${t.text}"`,
      );
    }
  }
  const tseen = new Set();
  for (const t of targets.filter((x) => !x.ok)) {
    const k = `${t.tag}|${t.w}x${t.h}|${t.label}`;
    if (tseen.has(k)) continue;
    tseen.add(k);
    lines.push(`target ${t.w}x${t.h} <${t.tag}> "${t.label}" — ${t.page}`);
  }
  return lines;
}

/* Standalone: node scripts/accessibility.mjs */
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await audit();
  const fails = describeFailures(result);
  console.log(`measured ${result.text.length} text nodes and ${result.targets.length} controls`);
  if (!fails.length) {
    console.log('all pass');
  } else {
    console.log(`${fails.length} distinct failure(s):`);
    for (const l of fails) console.log('  ' + l);
  }
  process.exit(fails.length ? 1 : 0);
}

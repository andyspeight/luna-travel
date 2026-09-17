/**
 * The walkthrough's anchors still exist.
 *
 * A coach-mark tour points at elements by a `data-tour` attribute and at pages
 * by href. Both fail SILENTLY when somebody renames a page or a nav key: the
 * spotlight stops appearing, nothing throws, no test goes red, and the tour
 * quietly rots until an agency mentions it months later.
 *
 * So these read the actual source and check every anchor the steps name is
 * really there. Reading files rather than rendering is deliberate — the point
 * is to catch a rename in a file the tour does not import and would never pull
 * into a render test.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STEPS } from '@/app/agency/tour-steps';

const ROOT = process.cwd();
const AGENCY_DIR = join(ROOT, 'src/app/agency');
const CHROME = readFileSync(join(AGENCY_DIR, 'portal-chrome.tsx'), 'utf8');

/** Every .tsx under src/app, so an anchor can live on any page. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const ALL_SOURCE = sourceFiles(join(ROOT, 'src/app'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const targets = STEPS.map((s) => s.target).filter((t): t is string => !!t);
const hrefs = STEPS.map((s) => s.href).filter((h): h is string => !!h);

describe('walkthrough steps', () => {
  it('has steps at all', () => {
    expect(STEPS.length).toBeGreaterThan(3);
  });

  it('gives every step something to say', () => {
    for (const s of STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(20);
    }
  });

  it('opens and closes with an unanchored step', () => {
    // The welcome and the sign-off are about the product, not about a control,
    // and a spotlight on nothing in particular looks broken.
    expect(STEPS[0].target).toBeUndefined();
    expect(STEPS[STEPS.length - 1].target).toBeUndefined();
  });

  it('points at no element twice', () => {
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe('every anchor exists', () => {
  // Nav anchors are rendered as data-tour={`nav-${n.key}`}, so the literal
  // string never appears in the source — the key in the NAV list is what has
  // to be checked.
  const navTargets = targets.filter((t) => t.startsWith('nav-'));
  const elementTargets = targets.filter((t) => !t.startsWith('nav-'));

  it('uses nav keys that are really in the menu', () => {
    expect(navTargets.length).toBeGreaterThan(0);
    for (const t of navTargets) {
      const key = t.slice('nav-'.length);
      expect(CHROME, `nav key "${key}" is not in the portal menu`).toContain(`key: '${key}'`);
    }
  });

  it('renders the data-tour attribute on the nav', () => {
    // The templated attribute itself, without which none of the nav steps work.
    expect(CHROME).toContain('data-tour={`nav-${n.key}`}');
  });

  it('names data-tour attributes that exist in the app', () => {
    for (const t of elementTargets) {
      expect(ALL_SOURCE, `no element carries data-tour="${t}"`).toContain(`data-tour="${t}"`);
    }
  });
});

describe('every href is a real page', () => {
  it('resolves to a page file', () => {
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const rel = href.replace(/^\//, '');
      const page = join(ROOT, 'src/app', rel, 'page.tsx');
      expect(existsSync(page), `${href} has no page at ${rel}/page.tsx`).toBe(true);
    }
  });

  it('stays inside the agency portal', () => {
    // A step that wandered onto the traveller side would cross the domain
    // split and bounce the agent to my-booking.co mid-tour.
    for (const href of hrefs) expect(href.startsWith('/agency')).toBe(true);
  });
});

describe('the guide the last step promises', () => {
  it('exists and is in the menu', () => {
    expect(existsSync(join(AGENCY_DIR, 'guide/page.tsx'))).toBe(true);
    expect(CHROME).toContain("key: 'guide'");
  });

  it('is what the closing step sends people to', () => {
    // The tour signs off by naming the guide. If that page is ever removed the
    // last thing the walkthrough says becomes a lie.
    expect(STEPS[STEPS.length - 1].body).toMatch(/guide/i);
  });
});

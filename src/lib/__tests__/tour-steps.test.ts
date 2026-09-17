/**
 * The walkthrough's anchors still exist, and it still never navigates.
 *
 * A coach-mark tour points at elements by a `data-tour` attribute, which fails
 * SILENTLY when somebody renames one or changes a nav key: the spotlight stops
 * appearing, nothing throws, no other test goes red, and the tour quietly rots
 * until an agency mentions it months later.
 *
 * So these read the actual source and check every anchor is really there.
 * Reading files rather than rendering is deliberate — the point is to catch a
 * rename in a file the tour does not import and would never pull into a render
 * test.
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
  it('resolves every target, nav item or element alike', () => {
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      if (t.startsWith('nav-')) {
        // Nav anchors render as data-tour={`nav-${n.key}`}, so the literal
        // string never appears in the source — the key in the NAV list is what
        // has to be checked.
        const key = t.slice('nav-'.length);
        expect(CHROME, `nav key "${key}" is not in the portal menu`).toContain(`key: '${key}'`);
      } else {
        expect(ALL_SOURCE, `no element carries data-tour="${t}"`).toContain(`data-tour="${t}"`);
      }
    }
  });

  it('renders the templated attribute on the nav', () => {
    // Without this one line, none of the nav steps have anything to point at.
    expect(CHROME).toContain('data-tour={`nav-${n.key}`}');
  });
});

describe('the tour never moves the agent', () => {
  it('has no step that navigates', () => {
    // Navigating remounted the portal shell, so pressing Next flashed the whole
    // page and read as the tour reloading the site. Every step must point at
    // something already on screen. The menu is on every page, so a step about a
    // section spotlights its nav item — which is also why this is enforceable
    // rather than a note somebody will forget.
    for (const step of STEPS) {
      expect(Object.keys(step)).not.toContain('href');
    }
  });

  it('only points at things present on every page, or at nothing', () => {
    // A target that lives on one page would leave the spotlight missing for an
    // agent who started the tour somewhere else.
    for (const t of targets) {
      expect(t.startsWith('nav-'), `"${t}" is not on every page`).toBe(true);
    }
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

import { describe, it, expect } from 'vitest';
import { brandVars, BRAND_VAR_KEYS } from '@/lib/brand';
import { parseHex, contrast, AA_NORMAL, AA_LARGE, DARKEST_LIGHT_SURFACE, PHOTO_SCRIM_FLOOR } from '@/lib/contrast';

/**
 * An agency picks its own colours and nobody checks them. So the check is
 * here: whatever they choose, a traveller must be able to read their booking.
 */

const rgb = (channels: string) => {
  const [r, g, b] = channels.split(' ').map(Number);
  return { r, g, b };
};
const SURFACE = parseHex(DARKEST_LIGHT_SURFACE)!;

describe('the readable shade of an agency accent', () => {
  // THE case the old fixed darkening could not handle. Mixing 22% toward
  // black leaves a pale yellow at roughly 2:1 — cream text on a white card.
  it('rescues a pale brand colour', () => {
    const v = brandVars(undefined, '#ffe066');
    expect(contrast(rgb(v['--brand-accent-dark-rgb']), SURFACE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('holds for any colour an agency could type', () => {
    for (let h = 0; h < 360; h += 10) {
      for (const l of [15, 40, 65, 88, 97]) {
        const hex = hsl(h, 90, l);
        const v = brandVars(undefined, hex);
        const got = contrast(rgb(v['--brand-accent-dark-rgb']), SURFACE);
        expect(got, `${hex} came out at ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('leaves a colour that already passes close to where it was', () => {
    const navy = '#1b2b5b';
    const v = brandVars(undefined, navy);
    expect(v['--brand-accent-dark-rgb']).toBe('27 43 91');
  });
});

describe('the light shade of an agency accent', () => {
  // Where it lives: the destination photo on the trip reveal ("Rome", the
  // countdown), and every dark-mode surface. It was a fixed 42% toward white,
  // so a deep brand colour came out a mid grey-blue that vanished on both.
  const FLOOR = parseHex(PHOTO_SCRIM_FLOOR)!;
  const DARK_SURFACES = ['#0f172a', '#1e293b', '#334155'].map((h) => parseHex(h)!);

  it('reads on the worst photo the reveal can show, for any colour an agency could type', () => {
    for (let h = 0; h < 360; h += 10) {
      for (const l of [15, 40, 65, 88, 97]) {
        const hex = hsl(h, 90, l);
        const got = contrast(rgb(brandVars(undefined, hex)['--brand-accent-light-rgb']), FLOOR);
        expect(got, `${hex} came out at ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
      }
    }
  });

  it('and is past 4.5:1 as small text on every dark surface', () => {
    for (let h = 0; h < 360; h += 10) {
      for (const l of [15, 40, 65, 88, 97]) {
        const hex = hsl(h, 90, l);
        const light = rgb(brandVars(undefined, hex)['--brand-accent-light-rgb']);
        for (const surface of DARK_SURFACES) {
          expect(contrast(light, surface), hex).toBeGreaterThanOrEqual(AA_NORMAL);
        }
      }
    }
  });

  // The one the old mix got most wrong.
  it('rescues a deep navy accent', () => {
    const light = rgb(brandVars(undefined, '#1b2b5b')['--brand-accent-light-rgb']);
    expect(contrast(light, FLOOR)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('leaves a light accent that already reads exactly where it was', () => {
    // #2ec4b6 mixed 42% toward white (134 221 213) already clears 3:1 on the
    // floor, so the solver must hand it back untouched.
    const v = brandVars(undefined, '#2ec4b6');
    expect(v['--brand-accent-light-rgb']).toBe('134 221 213');
  });
});

describe('text placed on an agency fill', () => {
  // White on a pale brand button is the standard way a white-label app loses
  // a whole screen of copy.
  it('is dark where the fill is pale', () => {
    expect(brandVars(undefined, '#ffe066')['--brand-accent-on-rgb']).toBe('15 23 42');
    expect(brandVars('#5eead4')['--brand-primary-on-rgb']).toBe('15 23 42');
  });

  it('is white where the fill is deep', () => {
    expect(brandVars('#1b2b5b')['--brand-primary-on-rgb']).toBe('255 255 255');
  });

  it('clears the bar for a pill on any fill, right around the wheel', () => {
    for (let h = 0; h < 360; h += 10) {
      for (const l of [12, 35, 60, 85, 98]) {
        const hex = hsl(h, 85, l);
        const v = brandVars(hex, hex);
        const fill = parseHex(hex)!;
        for (const key of ['--brand-primary-on-rgb', '--brand-accent-on-rgb']) {
          const got = contrast(rgb(v[key]), fill);
          expect(got, `${hex} ${key} came out at ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(
            AA_LARGE,
          );
        }
      }
    }
  });
});

describe('when an agency has set nothing', () => {
  it('writes no variables, so the Luna defaults stand', () => {
    expect(brandVars()).toEqual({});
    expect(brandVars('not-a-colour', 'nor-this')).toEqual({});
  });

  it('takes one family without inventing the other', () => {
    expect(Object.keys(brandVars('#1b2b5b'))).toEqual([
      '--brand-primary-rgb',
      '--brand-primary-light-rgb',
      '--brand-primary-on-rgb',
    ]);
  });
});

describe('the variable list', () => {
  // They are cleared as a set. A key that is written but never cleared keeps
  // one agency's colour on the next agency's screen.
  it('covers every variable the builder can write', () => {
    const all = new Set([
      ...Object.keys(brandVars('#1b2b5b', '#00b4d8')),
    ]);
    for (const k of all) expect(BRAND_VAR_KEYS).toContain(k);
    expect(BRAND_VAR_KEYS.length).toBe(all.size);
  });
});

/** Minimal HSL→hex so the sweeps can cover the wheel. */
function hsl(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

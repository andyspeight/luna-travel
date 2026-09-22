import { describe, it, expect } from 'vitest';
import {
  parseHex,
  toHex,
  contrast,
  readableOn,
  textOn,
  required,
  luminance,
  AA_NORMAL,
  AA_LARGE,
  DARKEST_LIGHT_SURFACE,
} from '@/lib/contrast';

/**
 * Agencies choose their own colours, so this is the code standing between a
 * badly chosen brand colour and a traveller who cannot read their own booking.
 */

const hex = (h: string) => parseHex(h)!;
const WHITE = hex('#ffffff');
const CHIP = hex(DARKEST_LIGHT_SURFACE);

describe('the published formula', () => {
  // Anchors from the WCAG definition. If these drift, everything else is
  // measuring something that is not contrast.
  it('is 21:1 between black and white', () => {
    expect(contrast(hex('#000000'), WHITE)).toBeCloseTo(21, 5);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrast(hex('#3b82f6'), hex('#3b82f6'))).toBeCloseTo(1, 10);
  });

  it('does not care which way round the arguments go', () => {
    expect(contrast(hex('#0f172a'), WHITE)).toBeCloseTo(contrast(WHITE, hex('#0f172a')), 10);
  });

  it('puts mid grey where the standard puts it', () => {
    // #767676 on white is the canonical "just passes 4.5:1" grey.
    expect(contrast(hex('#767676'), WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('#777777'), WHITE)).toBeLessThan(4.54);
  });

  it('reads white as full luminance and black as none', () => {
    expect(luminance(WHITE)).toBeCloseTo(1, 10);
    expect(luminance(hex('#000000'))).toBeCloseTo(0, 10);
  });
});

describe('readableOn', () => {
  // THE case. A fixed 22% darkening leaves this unreadable; solving does not.
  it('rescues a pale brand colour that a fixed darkening would not', () => {
    const paleYellow = hex('#ffe066');
    expect(contrast(paleYellow, WHITE)).toBeLessThan(2);
    const fixed = { r: 199, g: 175, b: 80 }; // what mixing 22% toward black gives
    expect(contrast(fixed, WHITE)).toBeLessThan(AA_NORMAL);

    const solved = readableOn(paleYellow, WHITE);
    expect(contrast(solved, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('leaves a colour alone when it already passes', () => {
    const navy = hex('#1b2b5b');
    expect(toHex(readableOn(navy, WHITE))).toBe('#1b2b5b');
  });

  it('stops as soon as it passes, rather than going to black', () => {
    const solved = readableOn(hex('#00b4d8'), WHITE);
    expect(contrast(solved, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
    // Still recognisably the brand: nowhere near black.
    expect(luminance(solved)).toBeGreaterThan(0.05);
  });

  it('lightens instead of darkening on a dark background', () => {
    const solved = readableOn(hex('#1b2b5b'), hex('#0f172a'));
    expect(contrast(solved, hex('#0f172a'))).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(luminance(solved)).toBeGreaterThan(luminance(hex('#1b2b5b')));
  });

  it('holds for every hue, not just the ones we happened to try', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [25, 50, 75, 92]) {
        const c = hslHex(h, 85, l);
        const solved = readableOn(hex(c), CHIP);
        expect(
          contrast(solved, CHIP),
          `hue ${h} lightness ${l} (${c}) came out at ${contrast(solved, CHIP).toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('can be asked for the lower large-text bar instead', () => {
    const solved = readableOn(hex('#00b4d8'), WHITE, AA_LARGE);
    expect(contrast(solved, WHITE)).toBeGreaterThanOrEqual(AA_LARGE);
    // And is lighter than the normal-text answer, having had to move less.
    expect(luminance(solved)).toBeGreaterThan(luminance(readableOn(hex('#00b4d8'), WHITE)));
  });

  it('gives the best available rather than throwing on an impossible ask', () => {
    // No colour reaches 7:1 against mid grey in either direction.
    const solved = readableOn(hex('#808080'), hex('#808080'), 7);
    expect(solved).toBeTruthy();
    expect(contrast(solved, hex('#808080'))).toBeGreaterThan(1);
  });
});

describe('textOn', () => {
  // White label text on a pale brand button is the classic way to lose a
  // whole screen of copy.
  it('puts dark text on a pale fill', () => {
    expect(toHex(textOn(hex('#ffe066')))).toBe('#0f172a');
    expect(toHex(textOn(hex('#5eead4')))).toBe('#0f172a');
  });

  it('puts white text on a deep fill', () => {
    expect(toHex(textOn(hex('#1b2b5b')))).toBe('#ffffff');
    expect(toHex(textOn(hex('#7c2d12')))).toBe('#ffffff');
  });

  it('always clears the large-text bar, whatever the fill', () => {
    for (let h = 0; h < 360; h += 20) {
      for (const l of [20, 45, 70, 95]) {
        const fill = hex(hslHex(h, 80, l));
        expect(contrast(textOn(fill), fill)).toBeGreaterThanOrEqual(AA_LARGE);
      }
    }
  });
});

describe('required', () => {
  it('asks 4.5 of ordinary text', () => {
    expect(required(14, 400)).toBe(AA_NORMAL);
    expect(required(17, 700)).toBe(AA_NORMAL);
    expect(required(23, 400)).toBe(AA_NORMAL);
  });

  it('asks 3 of text large enough to count as large', () => {
    expect(required(24, 400)).toBe(AA_LARGE);
    expect(required(19, 700)).toBe(AA_LARGE);
  });
});

describe('parseHex', () => {
  it('takes the forms an agency might actually type', () => {
    expect(toHex(parseHex('#1B2B5B')!)).toBe('#1b2b5b');
    expect(toHex(parseHex('1b2b5b')!)).toBe('#1b2b5b');
    expect(toHex(parseHex('#abc')!)).toBe('#aabbcc');
    expect(toHex(parseHex('  #abc  ')!)).toBe('#aabbcc');
  });

  it('refuses what it cannot read rather than guessing a colour', () => {
    expect(parseHex('rebeccapurple')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('')).toBeNull();
    expect(parseHex(null)).toBeNull();
    expect(parseHex(undefined)).toBeNull();
  });
});

/** Minimal HSL→hex, only so the sweeps above can cover the wheel. */
function hslHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

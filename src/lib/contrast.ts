/**
 * Colour contrast, so an agency's brand colour cannot make the app unreadable.
 *
 * Agencies choose their own colours. The app used to derive the readable shade
 * of an accent by mixing it 22% toward black — a fixed step that guarantees
 * nothing. A pale yellow stays pale, and the traveller gets cream text on a
 * white card; a near-black accent gets needlessly darker for no gain.
 *
 * So the shade is solved for instead: darken until it actually meets the
 * contrast requirement against the surface it will sit on, and stop there. The
 * brand still looks like the brand, and the text is legible whatever colour
 * somebody picked.
 *
 * WCAG 2.2 1.4.3: 4.5:1 for normal text, 3:1 for large (24px, or 18.66px bold)
 * and for the boundary of a control. The maths is the published formula, not
 * an approximation of it.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Normal text. The bar almost everything in the app has to clear. */
export const AA_NORMAL = 4.5;
/** Large text, and non-text boundaries such as a button's edge. */
export const AA_LARGE = 3;

/**
 * The darkest ordinary surface a light-mode screen puts text on.
 *
 * Solving against white would pass on white and fail on every tinted chip, and
 * a chip is exactly where small coloured labels live.
 */
export const LIGHTEST_SURFACE = '#ffffff';
/** The green wash behind a success badge — the darkest light surface in use. */
export const DARKEST_LIGHT_SURFACE = '#e0f3ef';

/**
 * The darkening laid over a destination photograph that carries text directly
 * (the trip reveal after an invite is redeemed). Never lighter than this
 * anywhere text can sit, so the worst photo there is still leaves a readable
 * backdrop.
 */
export const PHOTO_SCRIM = { r: 2, g: 6, b: 23, alpha: 0.62 } as const;

/**
 * What that scrim leaves behind over a PURE WHITE photo — the worst case, and
 * the one white-on-photo text is held to. Text on a scrimmed photo is checked
 * against this, not against the average photo.
 */
export const PHOTO_SCRIM_FLOOR = (() => {
  const over = (c: number) => Math.round(255 * (1 - PHOTO_SCRIM.alpha) + c * PHOTO_SCRIM.alpha);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(over(PHOTO_SCRIM.r))}${hex(over(PHOTO_SCRIM.g))}${hex(over(PHOTO_SCRIM.b))}`;
})();

export function parseHex(hex?: string | null): RGB | null {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio, 1..21. Order of the arguments does not matter. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix toward black (0) or white (255). */
export function mix(c: RGB, target: number, amount: number): RGB {
  const f = (v: number) => clamp(v + (target - v) * amount);
  return { r: f(c.r), g: f(c.g), b: f(c.b) };
}

/**
 * Black or white, whichever is legible on this fill.
 *
 * For a button filled with the agency's colour. White on a pale brand is the
 * single most common way a white-label app becomes unreadable, and it is
 * decided here rather than by whoever wrote the component.
 */
export function textOn(background: RGB): RGB {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 15, g: 23, b: 42 }; // the app's ink, not pure black
  return contrast(white, background) >= contrast(black, background) ? white : black;
}

/**
 * The nearest shade of `colour` that is legible on `background`.
 *
 * Walks toward black on a light background and toward white on a dark one, in
 * small steps, and stops at the first shade that clears the target — so the
 * result is as close to the chosen brand colour as legibility allows rather
 * than an arbitrary darkening.
 *
 * Returns black or white in the impossible case (a mid-grey background can be
 * unreachable at 4.5:1 from either direction); the caller gets the best
 * available rather than an exception on somebody's booking screen.
 */
export function readableOn(colour: RGB, background: RGB, target: number = AA_NORMAL): RGB {
  if (contrast(colour, background) >= target) return colour;

  const towardBlack = luminance(background) > 0.18;
  const destination = towardBlack ? 0 : 255;

  for (let amount = 0.02; amount <= 1; amount += 0.02) {
    const candidate = mix(colour, destination, amount);
    if (contrast(candidate, background) >= target) return candidate;
  }

  // Both directions exhausted: take whichever extreme is furthest away.
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  return contrast(black, background) >= contrast(white, background) ? black : white;
}

/** Does this pairing meet the bar? For assertions and for the audit. */
export function passes(fg: RGB, bg: RGB, target: number = AA_NORMAL): boolean {
  return contrast(fg, bg) >= target;
}

/**
 * The threshold a given size and weight has to clear.
 *
 * 18.66px is 14pt, which is where WCAG's "large" begins for bold text; 24px is
 * 18pt for everything else.
 */
export function required(fontSizePx: number, fontWeight: number): number {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return large ? AA_LARGE : AA_NORMAL;
}

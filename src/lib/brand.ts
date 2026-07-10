/**
 * White-label brand colour helpers.
 *
 * The traveller PWA themes off two CSS custom properties per shade —
 * `--brand-accent-*` (the `teal` token family) and `--brand-primary-*` (the
 * `navy` token family) — expressed as space-separated RGB channels so Tailwind's
 * `rgb(var(--x) / <alpha-value>)` tokens keep working with opacity modifiers.
 *
 * The active agency's `brandPrimaryColour` / `brandAccentColour` (already
 * sanitised to #RRGGBB by the booking mapper) are turned into those channel
 * strings here, with light/dark shades derived so the whole token family shifts
 * coherently. When an agency has no colour set, no variables are written and the
 * globals.css defaults (Luna Travel teal/navy) apply.
 */

type RGB = [number, number, number];

function parseHex(hex?: string | null): RGB | null {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Mix `rgb` toward `target` (0=black, 255=white) by `amt` (0..1). */
function mix([r, g, b]: RGB, target: number, amt: number): RGB {
  return [r + (target - r) * amt, g + (target - g) * amt, b + (target - b) * amt].map(clamp) as RGB;
}

const channels = (rgb: RGB) => `${rgb[0]} ${rgb[1]} ${rgb[2]}`;

/** The CSS variables this module manages. Cleared together when an agency has no brand colours. */
export const BRAND_VAR_KEYS = [
  '--brand-primary-rgb',
  '--brand-primary-light-rgb',
  '--brand-accent-rgb',
  '--brand-accent-light-rgb',
  '--brand-accent-dark-rgb',
] as const;

/**
 * Build the `{ cssVar: value }` overrides for an agency's colours. Only includes
 * a family (accent / primary) when that colour parses as valid hex; an empty
 * object means "use the Luna defaults".
 */
export function brandVars(primaryHex?: string, accentHex?: string): Record<string, string> {
  const out: Record<string, string> = {};

  const p = parseHex(primaryHex);
  if (p) {
    out['--brand-primary-rgb'] = channels(p);
    out['--brand-primary-light-rgb'] = channels(mix(p, 255, 0.18));
  }

  const a = parseHex(accentHex);
  if (a) {
    out['--brand-accent-rgb'] = channels(a);
    out['--brand-accent-light-rgb'] = channels(mix(a, 255, 0.42));
    // Darkened enough to stay legible as text (text-teal-dark) on light surfaces.
    out['--brand-accent-dark-rgb'] = channels(mix(a, 0, 0.22));
  }

  return out;
}

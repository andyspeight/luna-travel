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
 *
 * Two of those shades are SOLVED rather than nudged.
 *
 * The readable shade used to be the accent mixed 22% toward black, which
 * guarantees nothing: a pale yellow stays pale and the traveller gets cream
 * text on a white card, while a near-black accent is darkened for no gain. It
 * is now darkened only as far as it takes to clear 4.5:1 on the lightest
 * surface the app puts it on, so the brand still looks like the brand.
 *
 * The text that sits ON the accent — a filled button, a status pill — is
 * chosen between white and ink by measuring both. White on a pale brand colour
 * is the standard way a white-label app becomes unreadable, and it is not a
 * decision any individual component should be making.
 */

import {
  parseHex as parseColour,
  readableOn,
  textOn,
  mix as mixColour,
  DARKEST_LIGHT_SURFACE,
  PHOTO_SCRIM_FLOOR,
  AA_LARGE,
  type RGB as Colour,
} from '@/lib/contrast';

type RGB = [number, number, number];

function parseHex(hex?: string | null): RGB | null {
  const c = parseColour(hex);
  return c ? [c.r, c.g, c.b] : null;
}

const tuple = (c: Colour): RGB => [c.r, c.g, c.b];
const colour = ([r, g, b]: RGB): Colour => ({ r, g, b });

/** Mix `rgb` toward `target` (0=black, 255=white) by `amt` (0..1). */
function mix(rgb: RGB, target: number, amt: number): RGB {
  return tuple(mixColour(colour(rgb), target, amt));
}

const channels = (rgb: RGB) => `${rgb[0]} ${rgb[1]} ${rgb[2]}`;

/** The CSS variables this module manages. Cleared together when an agency has no brand colours. */
export const BRAND_VAR_KEYS = [
  '--brand-primary-rgb',
  '--brand-primary-light-rgb',
  '--brand-primary-on-rgb',
  '--brand-accent-rgb',
  '--brand-accent-light-rgb',
  '--brand-accent-dark-rgb',
  '--brand-accent-on-rgb',
] as const;

/**
 * Build the `{ cssVar: value }` overrides for an agency's colours. Only includes
 * a family (accent / primary) when that colour parses as valid hex; an empty
 * object means "use the Luna defaults".
 */
export function brandVars(primaryHex?: string, accentHex?: string): Record<string, string> {
  const out: Record<string, string> = {};

  const surface = parseColour(DARKEST_LIGHT_SURFACE)!;
  const photoFloor = parseColour(PHOTO_SCRIM_FLOOR)!;

  const p = parseHex(primaryHex);
  if (p) {
    out['--brand-primary-rgb'] = channels(p);
    out['--brand-primary-light-rgb'] = channels(mix(p, 255, 0.18));
    out['--brand-primary-on-rgb'] = channels(tuple(textOn(colour(p))));
  }

  const a = parseHex(accentHex);
  if (a) {
    out['--brand-accent-rgb'] = channels(a);
    // The light shade is what sits on dark: dark mode, and the destination
    // photo on the trip reveal. It used to be a fixed 42% toward white, so a
    // deep brand colour came out as a mid grey-blue that vanished on both.
    // Now lightened only as far as 3:1 on the photo's worst case needs, which
    // is also comfortably past 4.5:1 on every dark surface.
    out['--brand-accent-light-rgb'] = channels(
      tuple(readableOn(colour(mix(a, 255, 0.42)), photoFloor, AA_LARGE)),
    );
    // Solved, not nudged: as close to the agency's accent as 4.5:1 allows.
    out['--brand-accent-dark-rgb'] = channels(tuple(readableOn(colour(a), surface)));
    out['--brand-accent-on-rgb'] = channels(tuple(textOn(colour(a))));
  }

  return out;
}

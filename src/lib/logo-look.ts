/**
 * How an agency's logo should sit on a screen: whole, and on something it can
 * be read against.
 *
 * Every logo used to be squeezed into a small white square. A wide logo (most
 * of them: a mark with the name beside it) shrank to a sliver, and a logo with
 * white lettering on a transparent background, designed for dark backgrounds,
 * vanished into the white (24 Sep 2026, World Choice Sports: "the display is
 * awful").
 *
 * So each uploaded logo is measured once, when it is saved (lib/logo-analyze):
 * its shape, and its tone:
 *
 *   light  mostly light ink on transparency (white lettering)
 *   dark   mostly dark ink on transparency
 *   mixed  neither, or both
 *   boxed  it carries its own background, so it can go anywhere as it is
 *   unknown  it could not be measured (a pasted link, or it would not load)
 *
 * and each screen says whether it puts the logo on a dark or a light surface.
 * A plate goes behind the logo only when the two would clash. Pure: shared by
 * the server that stores the tone and the screens that read it.
 */

export type LogoTone = 'light' | 'dark' | 'mixed' | 'boxed' | 'unknown';

export interface LogoMeta {
  /** Pixel size of the uploaded file; 0 when unknown. */
  w: number;
  h: number;
  tone: LogoTone;
}

export type Surface = 'dark' | 'light';
export type Plate = 'none' | 'white' | 'dark';

const TONES: LogoTone[] = ['light', 'dark', 'mixed', 'boxed', 'unknown'];

export function parseLogoMeta(v: unknown): LogoMeta | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const tone = TONES.includes(o.tone as LogoTone) ? (o.tone as LogoTone) : null;
  if (!tone) return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 100_000 ? Math.round(x) : 0);
  return { w: n(o.w), h: n(o.h), tone };
}

/**
 * The tone of a logo from its pixels. `opaque` is the share of all pixels that
 * are solid; `light` and `dark` are shares of the solid ones.
 */
export function toneOf(stats: { opaque: number; light: number; dark: number }): LogoTone {
  if (stats.opaque >= 0.9) return 'boxed';
  if (stats.light >= 0.55) return 'light';
  if (stats.dark >= 0.55) return 'dark';
  return 'mixed';
}

/**
 * What goes behind the logo on this surface.
 *
 * Light ink needs dark behind it and dark ink needs white; a boxed logo brings
 * its own. A mixed or unmeasured logo is treated the way logos are usually
 * designed: for white. So it sits bare on a light surface and on a white plate
 * on a dark one.
 */
export function plateFor(tone: LogoTone | undefined, surface: Surface): Plate {
  switch (tone) {
    case 'boxed':
      return 'none';
    case 'light':
      return surface === 'dark' ? 'none' : 'dark';
    case 'dark':
      return surface === 'light' ? 'none' : 'white';
    default:
      return surface === 'light' ? 'none' : 'white';
  }
}

/** Width over height, or null when the shape is not known. */
export function aspectOf(meta: LogoMeta | null | undefined): number | null {
  return meta && meta.w > 0 && meta.h > 0 ? meta.w / meta.h : null;
}

/**
 * A wide logo almost always spells the name out beside its mark, so a screen
 * that shows it need not print the name again underneath.
 */
export function isWordmark(meta: LogoMeta | null | undefined): boolean {
  const a = aspectOf(meta);
  return a !== null && a >= 2.2;
}

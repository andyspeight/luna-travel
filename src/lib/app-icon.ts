/**
 * The traveller's home-screen icon, and the manifest that names the app.
 *
 * Every agency's travellers got the same "LT" icon and a home screen that said
 * "Luna Travel" (23 Sep 2026: "not everyone will want LT"). Now the icon is the
 * agency's own square image when they upload one on App branding, and
 * otherwise the first letter of the app's name on the agency's colours.
 *
 * Both are drawn by /api/app/icon at exactly the sizes phones ask for, and the
 * manifest and icon URLs carry everything needed to draw them. That keeps the
 * routes free of any lookup (so they cache for ever at the edge), and means a
 * change of name, colour or icon is simply a different URL.
 *
 * Nothing in a URL is trusted: /api/app/icon re-reads it with parseIconQuery,
 * and an image is only ever fetched from our own Blob store's agency-icons
 * folder, so the route cannot be used to fetch anything else.
 *
 * Pure: shared by the browser (to build the URLs) and the routes (to read them).
 */

import { appNameOf, initialOf, type Named } from '@/lib/app-name';
import { parseHex, toHex } from '@/lib/contrast';

/** 180 is the iPhone home screen; 192 and 512 are what Android installs need. */
export const ICON_SIZES = [180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** The app's own navy and teal, for an agency that has chosen no colours. */
export const DEFAULT_PRIMARY = '#1b2b5b';
export const DEFAULT_ACCENT = '#00b4d8';

/** An uploaded icon lives in our public Blob store, in the icons folder. */
const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
const ICON_FOLDER = '/agency-icons/';

/** Only the formats the icon renderer can read. It cannot read WebP. */
export const ICON_IMAGE_TYPES = ['image/png', 'image/jpeg'];

export interface IconSpec {
  /** One letter or digit, or '' for the plane. */
  initial: string;
  primary: string; // #rrggbb
  accent: string; // #rrggbb
  /** The agency's own uploaded icon, when it has one. */
  imageUrl?: string;
}

export interface AgencyLook extends Named {
  brandPrimaryColour?: string | null;
  brandAccentColour?: string | null;
  iconUrl?: string | null;
}

const hex = (v: unknown, fallback: string) => {
  const c = typeof v === 'string' ? parseHex(v) : null;
  return c ? toHex(c) : fallback;
};

/**
 * The letter drawn on a generated icon. Latin letters and digits only: the
 * renderer carries one Latin font, and a letter it cannot draw would be an
 * empty box on somebody's home screen. Anything else gets the plane.
 */
export function iconInitial(name: string | null | undefined): string {
  const l = initialOf(name);
  return /^[\p{Script=Latin}\p{N}]$/u.test(l) ? l : '';
}

/** Is this an icon we stored, in our own Blob store? */
export function isStoredIconUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      BLOB_HOST.test(u.hostname) &&
      u.pathname.startsWith(ICON_FOLDER) &&
      !u.pathname.includes('..') &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}

/** Is this stored icon inside this agency's own folder? */
export function isOwnIconUrl(v: unknown, agencyId: string): v is string {
  return !!agencyId && isStoredIconUrl(v) && new URL(v).pathname.startsWith(`${ICON_FOLDER}${agencyId}-`);
}

export function iconSpecFor(agency: AgencyLook | null | undefined): IconSpec {
  return {
    initial: iconInitial(appNameOf(agency)),
    primary: hex(agency?.brandPrimaryColour, DEFAULT_PRIMARY),
    accent: hex(agency?.brandAccentColour, DEFAULT_ACCENT),
    imageUrl: isStoredIconUrl(agency?.iconUrl) ? agency!.iconUrl! : undefined,
  };
}

function specParams(spec: IconSpec): URLSearchParams {
  const q = new URLSearchParams();
  if (spec.initial) q.set('l', spec.initial);
  q.set('p', spec.primary.slice(1));
  q.set('a', spec.accent.slice(1));
  if (spec.imageUrl) q.set('u', spec.imageUrl);
  return q;
}

/** Where the icon of this size is drawn. `maskable` leaves Android room to crop. */
export function iconUrl(spec: IconSpec, size: IconSize, maskable = false): string {
  const q = specParams(spec);
  q.set('s', String(size));
  if (maskable) q.set('m', '1');
  return `/api/app/icon?${q.toString()}`;
}

export function manifestUrl(spec: IconSpec, name: string): string {
  const q = specParams(spec);
  const n = cleanName(name);
  if (n) q.set('n', n);
  return `/api/app/manifest?${q.toString()}`;
}

/** A name fit for a home screen: printable, one line, not absurdly long. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/**
 * Read an icon or manifest URL back. Null when anything in it is not what
 * iconUrl or manifestUrl would have written.
 */
export function parseIconQuery(q: URLSearchParams): { spec: IconSpec; size: IconSize | null; maskable: boolean; name: string } | null {
  const l = q.get('l') ?? '';
  if (l && iconInitial(l) !== l) return null;
  const p = q.get('p') ?? '';
  const a = q.get('a') ?? '';
  if (!/^[0-9a-f]{6}$/.test(p) || !/^[0-9a-f]{6}$/.test(a)) return null;
  const u = q.get('u');
  if (u !== null && !isStoredIconUrl(u)) return null;
  const s = q.get('s');
  const size = s === null ? null : (ICON_SIZES as readonly number[]).includes(Number(s)) ? (Number(s) as IconSize) : undefined;
  if (size === undefined) return null;
  return {
    spec: { initial: l, primary: `#${p}`, accent: `#${a}`, imageUrl: u ?? undefined },
    size,
    maskable: q.get('m') === '1',
    name: cleanName(q.get('n') ?? ''),
  };
}

/** Under the icon, Android prints the short name; keep it to what fits. */
export function shortNameOf(name: string): string {
  if (name.length <= 12) return name;
  const first = name.split(' ')[0];
  return first.length <= 12 ? first : name.slice(0, 12);
}

/** The web app manifest for an agency's app. */
export function buildManifest(spec: IconSpec, name: string) {
  const appName = cleanName(name) || 'Your trip';
  return {
    // One identity for the app whatever it is called, so a rename updates the
    // installed app rather than looking like a second one.
    id: '/',
    name: appName,
    short_name: shortNameOf(appName),
    description: 'Your trip in your pocket, from confirmation to coming home.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: spec.primary,
    theme_color: spec.primary,
    categories: ['travel', 'lifestyle'],
    lang: 'en-GB',
    dir: 'ltr',
    icons: [
      { src: iconUrl(spec, 192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconUrl(spec, 512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconUrl(spec, 512, true), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/**
 * GET /api/app/icon — an agency's home-screen icon, drawn at the size asked for.
 *
 * Query (built by lib/app-icon iconUrl, and re-checked here):
 *   s  180 | 192 | 512        the size in pixels, square
 *   l  one letter or digit    the app name's initial; absent draws a plane
 *   p  rrggbb, a  rrggbb      the agency's primary and accent colours
 *   u  (optional)             the agency's own uploaded icon, in our Blob store
 *   m  1 (optional)           maskable: keep the picture inside Android's
 *                             safe zone, because the launcher crops to a circle
 *   b  1 (optional)           badge: Android's notification badge, the letter
 *                             or plane in white on nothing, since Android draws
 *                             only the shape
 *
 * The uploaded icon is drawn on the brand colours, so a transparent PNG does
 * not end up on the black iOS puts behind transparency. It must be an icon an
 * agency has actually saved: the URL shape alone would let anyone with a Blob
 * store of their own have this domain serve their picture. If it is not, or it
 * cannot be read, the letter is drawn instead and the answer is cached
 * briefly, so a passing storage hiccup does not stick on a phone for a year.
 *
 * Public on purpose: a home screen fetches its icon with no session, and
 * everything the picture shows is already in the URL.
 */

import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseIconQuery, ICON_IMAGE_TYPES, type IconSpec } from '@/lib/app-icon';
import { BRAND_IMAGE_MAX_BYTES } from '@/lib/brand-upload';
import { parseHex, textOn, toHex, type RGB } from '@/lib/contrast';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOREVER = 'public, max-age=86400, s-maxage=31536000, immutable';
const BRIEFLY = 'public, max-age=300, s-maxage=300';

let font: Promise<Buffer> | null = null;
const loadFont = () => (font ??= readFile(join(process.cwd(), 'src/assets/fonts/InstrumentSans-Bold.ttf')));

/** Is this the icon some agency saved on App branding? */
async function isSavedIcon(url: string): Promise<boolean> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('agency_branding')
      .select('agency_id')
      .eq('icon_url', url)
      .limit(1);
    return !!data?.length;
  } catch {
    return false;
  }
}

/** The uploaded icon as a data URI, or null if it is not a readable PNG or JPEG. */
async function fetchImage(url: string): Promise<string | null> {
  if (!(await isSavedIcon(url))) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000), redirect: 'error', cache: 'no-store' });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ICON_IMAGE_TYPES.includes(type)) return null;
    if (Number(res.headers.get('content-length') || 0) > BRAND_IMAGE_MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > BRAND_IMAGE_MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * The fill: the primary colour, leaning a third of the way to the accent in
 * the far corner. All the way to the accent turns two brand colours that clash
 * (teal and amber, say) into mud in the middle; a third keeps it the agency's
 * colour with some light in it.
 */
function fillFor(spec: IconSpec): { from: string; to: string; ink: string } {
  const a = parseHex(spec.primary) as RGB;
  const b = parseHex(spec.accent) as RGB;
  const t = 0.35;
  const to = { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  const mid = { r: (a.r + to.r) / 2, g: (a.g + to.g) / 2, b: (a.b + to.b) / 2 };
  // White, unless the colour is pale enough that ink reads better.
  return { from: spec.primary, to: toHex(to), ink: toHex(textOn(mid)) };
}

export async function GET(req: Request) {
  const q = parseIconQuery(new URL(req.url).searchParams);
  if (!q || !q.size) return new Response('Bad icon request', { status: 400 });
  const { spec, size, maskable, badge } = q;

  if (badge) return badgeImage(spec, size);

  const image = spec.imageUrl ? await fetchImage(spec.imageUrl) : null;
  const { from, to, ink } = fillFor(spec);
  // Android's maskable safe zone is the middle 80%.
  const inner = Math.round(size * (maskable ? 0.8 : 1));

  let picture: React.ReactElement;
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    picture = <img src={image} width={inner} height={inner} style={{ objectFit: 'cover' }} />;
  } else if (spec.initial) {
    picture = (
      <div style={{ display: 'flex', fontFamily: 'Brand', fontSize: Math.round(size * (maskable ? 0.5 : 0.6)), color: ink, lineHeight: 1, marginTop: -size * 0.03 }}>
        {spec.initial}
      </div>
    );
  } else {
    const g = Math.round(size * (maskable ? 0.42 : 0.5));
    picture = (
      <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    );
  }

  const failed = !!spec.imageUrl && !image;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        }}
      >
        {picture}
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: 'Brand', data: await loadFont(), weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': failed ? BRIEFLY : FOREVER },
    },
  );
}

/** White on transparent: Android keeps only the shape of a badge. */
async function badgeImage(spec: IconSpec, size: number) {
  const glyph = spec.initial ? (
    <div style={{ display: 'flex', fontFamily: 'Brand', fontSize: Math.round(size * 0.8), color: '#ffffff', lineHeight: 1, marginTop: -size * 0.04 }}>
      {spec.initial}
    </div>
  ) : (
    <svg width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {glyph}
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: 'Brand', data: await loadFont(), weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': FOREVER },
    },
  );
}

/**
 * Measure an uploaded logo: its size and its tone (lib/logo-look). Server
 * only: it uses sharp, which Next.js already ships for image optimisation.
 *
 * Only a logo in our Blob store's logo folder is ever fetched, so this cannot
 * be pointed at anything else. A pasted link from before uploads existed is
 * simply not measured, and shows the way logos always did.
 */

import type { LogoMeta } from '@/lib/logo-look';
import { toneOf } from '@/lib/logo-look';

const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
const MAX_BYTES = 2 * 1024 * 1024;

export function isStoredLogoUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      BLOB_HOST.test(u.hostname) &&
      u.pathname.startsWith('/agency-logos/') &&
      !u.pathname.includes('..') &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}

// WCAG relative luminance, per channel.
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/**
 * Measure image bytes.
 *
 * sharp is loaded here rather than at the top of the file: it is native code,
 * and if it ever failed to load, the branding routes that import this module
 * would fail with it. This way a failure only means "not measured".
 */
export async function measureLogo(bytes: Buffer): Promise<LogoMeta> {
  const sharp = (await import('sharp')).default;
  const img = sharp(bytes, { failOn: 'none' });
  const { width = 0, height = 0 } = await img.metadata();
  // Small is plenty for proportions, and bounds the work on a large file.
  const { data } = await img.ensureAlpha().resize({ width: 160, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  let solid = 0;
  let light = 0;
  let dark = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    solid++;
    const L = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
    if (L > 0.6) light++;
    else if (L < 0.15) dark++;
  }
  const tone = solid === 0 ? 'unknown' : toneOf({ opaque: solid / pixels, light: light / solid, dark: dark / solid });
  return { w: width, h: height, tone };
}

/** Fetch and measure a stored logo. Never throws; "unknown" if it cannot. */
export async function analyzeLogo(url: string): Promise<LogoMeta> {
  const unknown: LogoMeta = { w: 0, h: 0, tone: 'unknown' };
  if (!isStoredLogoUrl(url)) return unknown;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000), redirect: 'error', cache: 'no-store' });
    if (!res.ok) return unknown;
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) return unknown;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return unknown;
    return await measureLogo(buf);
  } catch {
    return unknown;
  }
}

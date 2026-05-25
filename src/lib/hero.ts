/**
 * Destination hero library.
 *
 * Two systems, both keyed by ISO-2 primaryCountryCode:
 *   - destinationHero()  → dashboard/card hero  (gradient + glow)
 *   - cinematicCover()   → cover splash         (full-bleed background)
 *
 * UPDATED 24 May 2026 — real photography wiring.
 * Hero photos are now uploaded via /admin/heroes and stored in the public
 * Supabase bucket `destination-heroes` at `{CODE}/{variant}.webp`. The
 * deterministic public URL is built by heroImageUrl(). When a photo exists
 * it is layered ON TOP of the gradient (so the gradient shows through only
 * while the image loads or if none has been uploaded). This keeps every
 * call site synchronous and fully backward compatible — no component needs
 * to await anything, and a missing image degrades to the crafted gradient.
 *
 * Set NEXT_PUBLIC_SUPABASE_URL in Vercel (the public project URL — safe to
 * expose, it is already public for anon reads). If unset, image layers are
 * omitted and you simply get the gradients, exactly as before.
 */

export interface DestinationHero {
  gradient: string;
  glow: string;
  /** Optional uploaded photo layered over the gradient. Empty if none/unset. */
  image?: string;
}

const DEFAULT: DestinationHero = {
  gradient: 'linear-gradient(135deg, #1B2B5B 0%, #2A3F7A 100%)',
  glow:
    'radial-gradient(ellipse at 70% 20%, rgba(0,180,216,0.35), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(245,158,11,0.18), transparent 55%)',
};

const HEROES: Record<string, DestinationHero> = {
  MV: {
    gradient: 'linear-gradient(135deg, #48CAE4 0%, #00B4D8 30%, #0077B6 70%, #023E8A 100%)',
    glow:
      'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.28), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(245,158,11,0.20), transparent 55%)',
  },
  ES: {
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 35%, #1E40AF 100%)',
    glow:
      'radial-gradient(ellipse at 75% 15%, rgba(252,211,77,0.35), transparent 50%), radial-gradient(ellipse at 15% 100%, rgba(244,114,182,0.18), transparent 55%)',
  },
  AE: {
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 30%, #7C2D12 70%, #1E293B 100%)',
    glow:
      'radial-gradient(ellipse at 80% 25%, rgba(254,243,199,0.35), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(0,180,216,0.18), transparent 55%)',
  },
  GR: {
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 50%, #1E3A8A 100%)',
    glow:
      'radial-gradient(ellipse at 75% 20%, rgba(254,252,232,0.32), transparent 50%), radial-gradient(ellipse at 25% 100%, rgba(248,250,252,0.14), transparent 55%)',
  },
};

const BUCKET = 'destination-heroes';

/**
 * Deterministic public URL for an uploaded hero, or '' when the Supabase
 * public URL env var isn't set. Path matches the admin upload route.
 */
export function heroImageUrl(countryCode: string, variant: 'portrait' | 'landscape'): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !countryCode) return '';
  const code = countryCode.toUpperCase();
  return `${base}/storage/v1/object/public/${BUCKET}/${code}/${variant}.webp`;
}

export function destinationHero(countryCode: string): DestinationHero {
  const base = HEROES[countryCode.toUpperCase()] ?? DEFAULT;
  const image = heroImageUrl(countryCode, 'landscape');
  return image ? { ...base, image } : base;
}

export function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '';
  const base = 0x1f1e6;
  const codePoints = [...cc.toUpperCase()].map((ch) => base + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export interface CinematicCover {
  background: string;
  credit?: string;
}

const COVERS: Record<string, CinematicCover> = {
  MV: {
    background: [
      'linear-gradient(180deg, rgba(15,23,42,0.20) 0%, transparent 22%)',
      'linear-gradient(180deg, transparent 55%, rgba(2,32,71,0.45) 100%)',
      "url('/images/destinations/cover-mv-portrait.webp') center/cover no-repeat",
    ].join(', '),
    credit: 'Photo: Ishan @seefromthesky / Unsplash',
  },
  ES: {
    background: [
      'linear-gradient(180deg, rgba(15,23,42,0.22) 0%, transparent 22%)',
      'linear-gradient(180deg, transparent 55%, rgba(7,89,133,0.45) 100%)',
      "url('/images/destinations/cover-es-portrait.webp') center/cover no-repeat",
    ].join(', '),
    credit: 'Photo: Adobe Stock',
  },
  AE: {
    background: [
      'linear-gradient(180deg, rgba(15,23,42,0.18) 0%, transparent 25%)',
      'linear-gradient(180deg, transparent 50%, rgba(15,23,42,0.55) 100%)',
      "url('/images/destinations/cover-ae-portrait.webp') center/cover no-repeat",
    ].join(', '),
    credit: 'Photo: Adobe Stock',
  },
  GR: {
    background: [
      'linear-gradient(180deg, rgba(15,23,42,0.18) 0%, transparent 22%)',
      'linear-gradient(180deg, transparent 55%, rgba(15,23,42,0.50) 100%)',
      "url('/images/destinations/cover-gr-portrait.webp') center/cover no-repeat",
    ].join(', '),
    credit: 'Photo: Adobe Stock',
  },
};

const DEFAULT_COVER: CinematicCover = {
  background: [
    'radial-gradient(ellipse 80% 40% at 70% 10%, rgba(72,202,228,0.45), transparent 55%)',
    'radial-gradient(ellipse 60% 50% at 20% 100%, rgba(15,23,42,0.5), transparent 60%)',
    'linear-gradient(180deg, #1B2B5B 0%, #0F172A 100%)',
  ].join(', '),
};

/**
 * Cover background for the splash. If an uploaded portrait hero exists, it is
 * used as the photo layer (under the legibility gradients) in preference to
 * the bundled static webp. Falls back to the bundled cover, then the default.
 */
export function cinematicCover(countryCode: string): CinematicCover {
  const code = countryCode.toUpperCase();
  const uploaded = heroImageUrl(countryCode, 'portrait');

  if (uploaded) {
    // Reuse the per-destination legibility gradients where we have them, else
    // a sensible default top/bottom darkening, then the uploaded photo.
    const topBottom = code === 'AE'
      ? ['linear-gradient(180deg, rgba(15,23,42,0.18) 0%, transparent 25%)', 'linear-gradient(180deg, transparent 50%, rgba(15,23,42,0.55) 100%)']
      : ['linear-gradient(180deg, rgba(15,23,42,0.20) 0%, transparent 22%)', 'linear-gradient(180deg, transparent 55%, rgba(2,32,71,0.45) 100%)'];
    return {
      background: [...topBottom, `url("${uploaded}") center/cover no-repeat`].join(', '),
      credit: COVERS[code]?.credit,
    };
  }

  return COVERS[code] ?? DEFAULT_COVER;
}

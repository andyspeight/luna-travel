/**
 * Destination hero gradient library.
 *
 * Real photos require licensing — for the prototype we use crafted CSS
 * gradients per primaryCountryCode. Each one evokes the place: Maldives
 * is lagoon cyan, Dubai is sunset gold, Mallorca is Mediterranean, Athens
 * is Aegean.
 *
 * The shape is deliberately the same as widget-mybooking's hero gradients
 * so they're swappable when real photography is wired in for production.
 */

export interface DestinationHero {
  gradient: string;
  glow: string;
}

const DEFAULT: DestinationHero = {
  gradient: 'linear-gradient(135deg, #1B2B5B 0%, #2A3F7A 100%)',
  glow:
    'radial-gradient(ellipse at 70% 20%, rgba(0,180,216,0.35), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(245,158,11,0.18), transparent 55%)',
};

const HEROES: Record<string, DestinationHero> = {
  // Maldives — lagoon cyan into deep ocean
  MV: {
    gradient: 'linear-gradient(135deg, #48CAE4 0%, #00B4D8 30%, #0077B6 70%, #023E8A 100%)',
    glow:
      'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.28), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(245,158,11,0.20), transparent 55%)',
  },
  // Mallorca — Mediterranean turquoise + warm afternoon
  ES: {
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 35%, #1E40AF 100%)',
    glow:
      'radial-gradient(ellipse at 75% 15%, rgba(252,211,77,0.35), transparent 50%), radial-gradient(ellipse at 15% 100%, rgba(244,114,182,0.18), transparent 55%)',
  },
  // Dubai — desert sunset, gold to indigo
  AE: {
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 30%, #7C2D12 70%, #1E293B 100%)',
    glow:
      'radial-gradient(ellipse at 80% 25%, rgba(254,243,199,0.35), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(0,180,216,0.18), transparent 55%)',
  },
  // Athens — Aegean blue + marble white
  GR: {
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 50%, #1E3A8A 100%)',
    glow:
      'radial-gradient(ellipse at 75% 20%, rgba(254,252,232,0.32), transparent 50%), radial-gradient(ellipse at 25% 100%, rgba(248,250,252,0.14), transparent 55%)',
  },
};

export function destinationHero(countryCode: string): DestinationHero {
  return HEROES[countryCode.toUpperCase()] ?? DEFAULT;
}

/**
 * Country flag emoji (ISO-2 → regional indicator letters).
 * Used as a subtle accent, not the primary visual.
 */
export function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '';
  const base = 0x1f1e6;
  const codePoints = [...cc.toUpperCase()].map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/**
 * Cinematic full-bleed background for the cover splash.
 * Richer than the dashboard hero — multi-layer gradient meant to read as
 * photography from across the room. Each destination gets its own scene.
 *
 * When real photography is wired in for production, swap to:
 *   { image: '/images/cover-mv.webp', overlay: '...' }
 * but the shape stays the same so layout doesn't need to change.
 */
export interface CinematicCover {
  /** The main background — full layered CSS so the splash feels like a photo. */
  background: string;
  /** Optional credit string (Unsplash etc.) shown small in the corner. Empty for prototype. */
  credit?: string;
}

const COVERS: Record<string, CinematicCover> = {
  // Maldives — underwater turquoise into deep blue, sun rays from upper-right,
  // soft sand glow bottom-right. Reads as a lagoon shot.
  MV: {
    background: [
      // Sun glow (warm upper right)
      'radial-gradient(ellipse 80% 50% at 75% 5%, rgba(254,243,199,0.5), transparent 55%)',
      // Surface light shafts
      'radial-gradient(ellipse 40% 90% at 60% 0%, rgba(186,230,253,0.45), transparent 60%)',
      // Coral / sand glow bottom right
      'radial-gradient(ellipse 60% 40% at 90% 95%, rgba(251,191,36,0.18), transparent 60%)',
      // Deep water vignette bottom left
      'radial-gradient(ellipse 70% 70% at 10% 100%, rgba(2,32,71,0.55), transparent 60%)',
      // Base water gradient
      'linear-gradient(178deg, #67E8F9 0%, #22D3EE 15%, #06B6D4 30%, #0891B2 50%, #0E7490 70%, #155E75 85%, #082F49 100%)',
    ].join(', '),
  },
  // Mallorca — Mediterranean afternoon, turquoise sea meeting golden sand,
  // pine-shadow green hint top-left.
  ES: {
    background: [
      'radial-gradient(ellipse 80% 40% at 85% 8%, rgba(254,243,199,0.55), transparent 55%)',
      'radial-gradient(ellipse 50% 60% at 5% 5%, rgba(21,128,61,0.25), transparent 60%)',
      'radial-gradient(ellipse 100% 30% at 50% 100%, rgba(254,215,170,0.6), transparent 75%)',
      'linear-gradient(180deg, #38BDF8 0%, #0EA5E9 25%, #0284C7 50%, #075985 75%, #0C4A6E 100%)',
    ].join(', '),
  },
  // Dubai — desert sunset, deep amber into midnight indigo, single point light.
  AE: {
    background: [
      'radial-gradient(ellipse 70% 45% at 70% 18%, rgba(254,243,199,0.65), transparent 55%)',
      'radial-gradient(ellipse 90% 30% at 50% 5%, rgba(252,165,165,0.4), transparent 60%)',
      'radial-gradient(ellipse 60% 60% at 100% 100%, rgba(124,45,18,0.55), transparent 65%)',
      'radial-gradient(ellipse 90% 50% at 50% 100%, rgba(15,23,42,0.7), transparent 75%)',
      'linear-gradient(180deg, #FDBA74 0%, #F97316 20%, #C2410C 40%, #7C2D12 60%, #431407 80%, #1E1B4B 100%)',
    ].join(', '),
  },
  // Athens — late afternoon Aegean, soft cream marble glow above, deep sea below.
  GR: {
    background: [
      'radial-gradient(ellipse 90% 50% at 50% 8%, rgba(254,252,232,0.5), transparent 55%)',
      'radial-gradient(ellipse 60% 30% at 80% 12%, rgba(254,215,170,0.35), transparent 60%)',
      'radial-gradient(ellipse 70% 50% at 15% 100%, rgba(8,47,73,0.5), transparent 65%)',
      'linear-gradient(180deg, #FEF3C7 0%, #93C5FD 18%, #3B82F6 38%, #1D4ED8 60%, #1E3A8A 80%, #0F172A 100%)',
    ].join(', '),
  },
};

const DEFAULT_COVER: CinematicCover = {
  background: [
    'radial-gradient(ellipse 80% 40% at 70% 10%, rgba(72,202,228,0.45), transparent 55%)',
    'radial-gradient(ellipse 60% 50% at 20% 100%, rgba(15,23,42,0.5), transparent 60%)',
    'linear-gradient(180deg, #1B2B5B 0%, #0F172A 100%)',
  ].join(', '),
};

export function cinematicCover(countryCode: string): CinematicCover {
  return COVERS[countryCode.toUpperCase()] ?? DEFAULT_COVER;
}

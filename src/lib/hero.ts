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

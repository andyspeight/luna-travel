/**
 * Inspirations — the agency's "where next" collection that powers the
 * post-trip rebooking surface (the in-app brochure).
 *
 * In production this list is per-agency and comes from the admin / Destination
 * Content base (the agency curates the trips it wants to promote). For the
 * prototype it's a sensible default set so the surface is populated out of the
 * box. Codes are ISO-3166-1 alpha-2 to match the hero system (src/lib/hero.ts)
 * and the 100-country roster (src/data/hero-destinations.ts), so any uploaded
 * destination photo is picked up automatically; until then the per-item
 * gradient gives each card a distinct, on-brand look.
 *
 * `fromPrice` is promotional "from" copy the agency sets for marketing — it is
 * NOT booking/supplier data and is always optional (a missing price simply
 * hides the chip). It is never derived from a real booking.
 */

export interface Inspiration {
  id: string;
  code: string; // ISO-2 — drives hero imagery + optional guide link
  name: string; // headline place, e.g. "Santorini"
  country: string; // e.g. "Greece"
  tagline: string; // short hook
  blurb: string; // one or two sentences
  nights?: number;
  fromPrice?: number; // promotional, agency-set, optional
  currency?: string; // default GBP
  tags?: string[];
  /** Distinct card gradient so cards look good before any photo is uploaded. */
  gradient: string;
}

const INSPIRATIONS: Inspiration[] = [
  {
    id: 'ins-gr-santorini',
    code: 'GR',
    name: 'Santorini',
    country: 'Greece',
    tagline: 'Caldera sunsets & whitewashed villages',
    blurb:
      'Cliff-top suites over a flooded volcano, blue-domed churches and the most photographed sunset in the Aegean. Pair it with a few days in Athens.',
    nights: 7,
    fromPrice: 1149,
    tags: ['Couples', 'Island', 'Iconic'],
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 55%, #1E3A8A 100%)',
  },
  {
    id: 'ins-mv-maldives',
    code: 'MV',
    name: 'Maldives',
    country: 'Maldives',
    tagline: 'Overwater villas & house reefs',
    blurb:
      'The reset everyone means when they say they need a holiday. Glass-clear lagoons, barefoot luxury and snorkelling straight off the deck.',
    nights: 7,
    fromPrice: 1899,
    tags: ['Luxury', 'Beach', 'Honeymoon'],
    gradient: 'linear-gradient(135deg, #48CAE4 0%, #00B4D8 35%, #0077B6 70%, #023E8A 100%)',
  },
  {
    id: 'ins-ae-dubai',
    code: 'AE',
    name: 'Dubai',
    country: 'United Arab Emirates',
    tagline: 'Sun, souks & sky-high dining',
    blurb:
      'Winter sun that always delivers — beach mornings, desert evenings and a food scene from £6 karak to two Michelin stars. A brilliant family stopover.',
    nights: 5,
    fromPrice: 899,
    tags: ['City', 'Family', 'Winter sun'],
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 35%, #7C2D12 75%, #1E293B 100%)',
  },
  {
    id: 'ins-bb-barbados',
    code: 'BB',
    name: 'Barbados',
    country: 'Caribbean',
    tagline: 'Platinum coast & rum shacks',
    blurb:
      'Calm west-coast beaches, lively Friday fish fries at Oistins and some of the warmest welcomes in the Caribbean. Long-haul, worth every hour.',
    nights: 10,
    fromPrice: 1549,
    tags: ['Beach', 'Couples', 'Long-haul'],
    gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 50%, #0369A1 100%)',
  },
  {
    id: 'ins-it-amalfi',
    code: 'IT',
    name: 'Amalfi Coast',
    country: 'Italy',
    tagline: 'Lemon groves & cliffside towns',
    blurb:
      'Positano stacked above the sea, long lunches, boat trips to Capri. The Mediterranean at its most romantic — and the food needs no introduction.',
    nights: 7,
    fromPrice: 1295,
    tags: ['Couples', 'Food', 'Coast'],
    gradient: 'linear-gradient(135deg, #FB923C 0%, #F43F5E 50%, #7C2D12 100%)',
  },
  {
    id: 'ins-is-iceland',
    code: 'IS',
    name: 'Iceland',
    country: 'Iceland',
    tagline: 'Northern lights & geothermal spas',
    blurb:
      'Waterfalls, volcanoes and the aurora overhead, then a long soak in a geothermal lagoon. A short-haul trip that feels like another planet.',
    nights: 4,
    fromPrice: 749,
    tags: ['Adventure', 'Short break', 'Nature'],
    gradient: 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 45%, #0F172A 100%)',
  },
];

/**
 * The collection to show a traveller, optionally excluding the destination
 * they're already on (by ISO-2 code) so it always reads as "where next".
 */
export function getInspirations(excludeCode?: string): Inspiration[] {
  const ex = (excludeCode ?? '').toUpperCase();
  const list = ex ? INSPIRATIONS.filter((i) => i.code.toUpperCase() !== ex) : INSPIRATIONS;
  return list;
}

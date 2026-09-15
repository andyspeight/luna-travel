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
 *
 * This list is now the OFFLINE FLOOR. Live suggestions come from the place
 * content chain (PlaceView.suggestions) via inspirationFromSuggestion(); when
 * there is no content — no AIRTABLE_KEY, an unmatched destination, a cold or
 * failing adapter — getInspirations() still answers, so the rebooking surface
 * and the enquiry funnel behind it are never blank.
 */

import type { PlaceSuggestion } from '@/types/destination-content';

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
  /**
   * City/region slug for heroImageUrl()'s third argument, so a suggestion gets
   * its own photo with the country image then the gradient behind it. Only ever
   * a slug the hero bucket was known to hold at index-generation time.
   */
  locationSlug?: string;
  /** The suggested place's own "Best For Tags", verbatim. DESCRIBES THE
   *  SUGGESTION, NOT THE TRAVELLER. Never put these in a first-person sentence:
   *  the enquiry is sent from the traveller's own address, so "We loved Orlando
   *  — Couples, Luxury, Honeymoons, Beach" reads to the agent as the traveller
   *  describing Orlando and mis-qualifies the lead. Use `sharedTags`, attributed
   *  to the machine, for anything a human will read. */
  audience?: string[];
  /** The tags this suggestion has in common with the place the traveller is
   *  actually booked into — the visible, defensible "why". This is the only tag
   *  set that may be shown to a traveller or an agent as a reason, and only ever
   *  as an explicit machine attribution (t('next.suggestedBecause')). */
  sharedTags?: string[];
  /** Airtable record id when this card came from place content, so a card can
   *  be traced back to the row that produced it. */
  sourceId?: string;
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

/** The card gradients, reused for suggestions so a live card is visually
 *  indistinguishable from a curated one before its photo loads. */
const GRADIENTS: string[] = INSPIRATIONS.map((i) => i.gradient);

/** Stable per-record gradient: the same suggestion keeps the same colours on
 *  every render and on every device, so the rail never flickers between them. */
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/**
 * A live suggestion as an Inspiration card.
 *
 * Deliberately sets no `nights` and no `fromPrice`: those are agency-set
 * promotional copy (see the header) and there is nothing in the content base
 * that may stand in for them.
 *
 * `blurb` is left EMPTY on purpose. The only sentence we can honestly write
 * about a live suggestion is "also good for <shared tags>", and that sentence
 * has to be translated — this module is plain data with no locale. So the tags
 * travel as structured `sharedTags` and InspirationCard renders them through
 * t('next.alsoGoodFor'). A French traveller was getting English here.
 *
 * `tags` (the chips the card actually renders) are the SHARED tags, so the card
 * shows the same "why" the rail's subline claims. They fall back to the
 * suggestion's own Best For Tags for a paired suggestion, which is curated by
 * an editor rather than chosen by tag overlap and so has no shared set.
 */
export function inspirationFromSuggestion(s: PlaceSuggestion): Inspiration {
  const shared = (s.sharedTags ?? []).filter(Boolean);
  const bestFor = (s.bestForTags ?? []).filter(Boolean);
  return {
    id: `sug-${s.id}`,
    code: s.code,
    name: s.name,
    country: s.ancestry?.length ? s.ancestry[s.ancestry.length - 1] : '',
    tagline: s.tagline ?? '',
    blurb: '',
    tags: shared.length > 0 ? shared : bestFor,
    locationSlug: s.heroSlug || undefined,
    audience: bestFor,
    sharedTags: shared,
    sourceId: s.id,
    gradient: gradientFor(s.id),
  };
}

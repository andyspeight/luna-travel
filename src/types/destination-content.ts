/**
 * Destination Content — shared types.
 *
 * TYPES ONLY: no runtime, no imports, no process.env. The server-only adapter
 * (src/lib/destination-content.ts) reads AIRTABLE_KEY and imports these; this
 * file is deliberately inert so a client component can import the same shapes
 * without dragging the adapter — and the key — into the browser bundle.
 */

export type PlaceTier = 'resort' | 'city' | 'country';

/** The closed 17-value icon vocabulary Highlights JSON is authored against. */
export type HighlightIcon =
  | 'mountain' | 'sunset' | 'wine' | 'water' | 'palm' | 'city' | 'temple'
  | 'beach' | 'food' | 'star' | 'camera' | 'heart' | 'building' | 'map'
  | 'compass' | 'sun' | 'snowflake';

export interface Highlight {
  /** null when Airtable named an icon outside the vocabulary. The card renders
   *  without a glyph — we never substitute a guessed icon, never drop the words. */
  icon: HighlightIcon | null;
  title: string;
  description: string;
  tier: PlaceTier;
  /** Display name of the place that authored it, e.g. "Orlando". */
  from: string;
}

export interface PlaceEvent {
  name: string;
  description: string;
  /** Verbatim token from Events JSON: "Oct", "Nov-Dec", "May-Sep". The source
   *  carries NO year, so this is the only date string ever rendered. */
  monthLabel: string;
  /** Wrap-aware expansion, 0 = January. [] when monthLabel is unparseable. */
  months: number[];
  tier: PlaceTier;
  from: string;
}

export interface ClimateBand {
  tier: PlaceTier;
  from: string;
  /** Exactly 12 slots Jan..Dec, or null when the cell did not parse to 12. */
  tempC: number[] | null;
  rainfallMm: number[] | null;
  season: Array<'best' | 'shoulder' | 'off'> | null;
}

/** A scalar that collapsed to one tier, carrying where it came from. */
export interface PlaceFact<T = string> {
  value: T;
  tier: PlaceTier;
  from: string;
}

export type PlaceSectionKey =
  | 'hero-intro'
  | 'overview'
  | 'what-makes-it-special'  // Cities only
  | 'character'             // Resorts only ("Character and Vibe")
  | 'things-to-do'
  | 'food'
  | 'beaches'               // Resorts only
  | 'getting-there'         // Cities + Countries
  | 'getting-around'        // Resorts only
  | 'nearby-excursions'     // Resorts only
  | 'best-time'
  | 'practical'             // Countries only ("Practical Info")
  | 'visa'                  // Countries only ("Visa Advisory")
  | 'health';               // Countries only ("Health Notes UK")

/** Prose STACKS: one entry per tier that has body text for this key, ordered
 *  most-specific-first. */
export interface PlaceSection {
  key: PlaceSectionKey;
  tier: PlaceTier;
  from: string;
  body: string;
}

export interface PlaceImage {
  url: string;
  attribution?: string;
  tier: PlaceTier;
  from: string;
}

export interface PlaceSuggestion {
  /** Airtable record id. */
  id: string;
  tier: PlaceTier;
  /** ISO-2 of the suggestion's own country. */
  code: string;
  slug: string;
  name: string;
  /** Parent chain display names, broadest last: ["Florida", "USA"]. */
  ancestry: string[];
  /** Roster slug with an uploaded hero, or '' — feeds heroImageUrl(). */
  heroSlug: string;
  tagline?: string;
  bestForTags: string[];
  /** 'paired'  = curated Best Paired With, INTRA-country → an "Add a few days"
   *              rail. Never rendered under "Where next?".
   *  'similar' = Best For Tags overlap in ANOTHER country → "Where next?". */
  reason: 'paired' | 'similar';
  /** Tags shared with the booking's own place — the visible "why". */
  sharedTags: string[];
}

export interface ParkRecord {
  id: string;
  /** Slugified Name, assigned at generation time (the table has no slug field). */
  slug: string;
  name: string;
  /** ISO-2 resolved at generation time from the free-text Country. */
  code: string;
  tagline?: string;
  attractionType?: string;
  operator?: string;
  /** Free text, e.g. "Orlando, Florida (Lake Buena Vista / Bay Lake)". */
  locationText?: string;
  overview?: string;
  /** "Best For" — a SEPARATE vocabulary from Best For Tags. Never merged. */
  bestFor: string[];
  daysNeeded?: string;
  bestTimeToVisit?: string;
  season?: string;
  ticketsAndPrices?: string;
  /** Guidance copy ("Premium (£200-£400)"). MUST NOT render as a from-price —
   *  inspirations.ts reserves that for agency-set marketing. */
  priceBand?: string;
  starAttractions?: string;
  familyGuide?: string;
  thrillGuide?: string;
  heightRestrictions?: string;
  fastTrackOptions?: string;
  foodAndDrink?: string;
  accessibility?: string;
  gettingThere?: string;
  nearestAirport?: string;
  nearestTown?: string;
  onSiteHotels?: string;
  hasOnSiteHotels: boolean;
  nearbyHotels?: string;
  quirksAndInsiderTips?: string;
  combineWith?: string;
  officialWebsite?: string;
  lat?: number;
  lng?: number;
  /** "Verified Date" — the only provenance this base carries. */
  verifiedDate?: string;
}

/** The flattened, merged view the surfaces render. */
export interface PlaceView {
  /** Most specific tier that contributed anything. */
  tier: PlaceTier;
  /** Slug of that most specific tier. */
  slug: string;
  /** ISO-2. */
  code: string;
  /** Breadcrumb, most specific first: ["Orlando", "Florida", "USA"]. */
  trail: string[];
  /** Hero eyebrow: "Orlando · Florida · USA". */
  breadcrumb: string;
  /** Most specific name: "Orlando". */
  name: string;
  /** Roster slug that actually has an uploaded hero, or '' — may be an
   *  ancestor's ("florida" for an Orlando booking). */
  heroSlug: string;

  region?: PlaceFact;
  tagline?: PlaceFact;

  facts: {
    currency?: PlaceFact;
    language?: PlaceFact;
    timeZone?: PlaceFact;
    voltageAndPlug?: PlaceFact;
    flightTimeFromUK?: PlaceFact;
  };

  sections: PlaceSection[];
  highlights: Highlight[];
  /** UNFILTERED. The traveller's dates are applied client-side. */
  events: PlaceEvent[];
  climate?: ClimateBand;
  /** Most specific tier that had real coordinates. Never guessed. */
  coords?: { lat: number; lng: number; tier: PlaceTier; from: string };
  images: PlaceImage[];
  bestForTags: string[];
  /** Resort "Who Is It Best For" (multipleSelects). Chips. */
  audienceTags: string[];
  /** City "Who Is It Best For" (multilineText). Prose — never chips. */
  audienceNote?: string;

  suggestions: PlaceSuggestion[];
  /** Every Live/Published park joined to any tier of the chain, capped by the
   *  adapter's MAX_PARKS (sized to clear the largest real chain in the index),
   *  with full bodies. Ticket matching happens on the client. */
  parks: ParkRecord[];

  /** Which tiers actually answered — drives UI and the drift log. */
  resolved: { resort: boolean; city: boolean; country: boolean };
  /** True when any tier was served from the stale-while-error cache. */
  stale: boolean;
  generatedAt: string;
}

export type PlaceFailure = 'not_configured' | 'unknown_place' | 'content_unavailable';

/** GET /api/traveller/place */
export interface PlaceResponse {
  configured: boolean;
  reason?: PlaceFailure;
  place: PlaceView | null;
}

/** GET /api/traveller/park */
export interface ParkResponse {
  configured: boolean;
  reason?: PlaceFailure;
  park: ParkRecord | null;
}

export const EMPTY_PLACE_RESPONSE: PlaceResponse = { configured: false, place: null };
export const EMPTY_PARK_RESPONSE: ParkResponse = { configured: false, park: null };

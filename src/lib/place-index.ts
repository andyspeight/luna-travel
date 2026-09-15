/**
 * Destination place index — resolution, synchronously and for free.
 *
 * Answers "which Airtable record describes this trip?" from the generated
 * snapshot in src/data/destination-places.ts. PURE and SYNCHRONOUS by contract:
 * order-to-booking.ts and location-match.ts are both documented pure and sit on
 * the booking-build path, so resolution can never become async and can never
 * depend on Airtable being reachable.
 *
 * Not for client bundles — the index is ~900 rows.
 */

import {
  PLACE_INDEX,
  PLACES_BY_COUNTRY,
  PLACE_BY_ID,
  PARKS_BY_PLACE,
  type IndexPlace,
} from '@/data/destination-places';
import type { PlaceTier } from '@/types/destination-content';
// Same great-circle helper the ticket→park matcher uses. park-match.ts imports
// nothing but a type, so this adds no dependency to the booking-build path and
// keeps ONE distance implementation in the codebase.
import { haversineKm } from '@/lib/park-match';

export type { IndexPlace, IndexPark } from '@/data/destination-places';

export interface PlaceRef {
  tier: PlaceTier;
  id: string;
  slug: string;
  code: string;
}

export interface PlaceCoords {
  lat: number;
  lng: number;
}

/**
 * How far a booking's coordinates may sit from a place row's centroid and still
 * resolve to it.
 *
 * Calibrated against the two cases that proved the literal-name resolver wrong:
 * Lake Buena Vista — Walt Disney World's actual postal city, and what suppliers
 * routinely send on an attraction ticket — is ~23 km from the Orlando row, and
 * Kissimmee, where a large share of Orlando villa guests stay, is ~28 km. 50 km
 * clears both with headroom for the Davenport/ChampionsGate villa belt while
 * staying an order of magnitude below the next US row in any direction (the
 * Gulf Coast row is 133 km from Lake Buena Vista). Anything much larger starts
 * annexing genuinely different destinations.
 */
export const COORD_RESOLVE_KM = 50;

/**
 * Two rows whose distances differ by less than this are "comparably close" and
 * the winner is decided by tier, not by centroid arithmetic.
 *
 * A place row's lat/lng is a single editorial point, not a boundary, so a few
 * kilometres of difference between two candidates carries no information about
 * which one the traveller is actually in. When the tie cannot be broken by tier
 * we return NOTHING and let the country fallback run: a coarse-but-correct page
 * beats a confident wrong one, which is the same discipline location-match.ts
 * and park-match.ts already apply.
 */
export const COORD_AMBIGUOUS_KM = 15;

/** Normalise a free-text place signal: NFD accent-strip, lowercase, '&'→' ',
 *  non-alphanumerics→' ', collapse whitespace, trim. Identical output to the
 *  private norm() in location-match.ts. Exported so both use one definition. */
export function normPlace(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// The generated module is written by a script that may not have run yet, and a
// regeneration can legitimately produce an empty table for a tier. Every read
// goes through these so a missing or empty export degrades to "no match" rather
// than a TypeError on the booking-build path.
function allPlaces(): IndexPlace[] {
  return Array.isArray(PLACE_INDEX) ? PLACE_INDEX : [];
}

function placesInCountry(code: string): IndexPlace[] {
  const rows = PLACES_BY_COUNTRY ? PLACES_BY_COUNTRY[code] : undefined;
  return Array.isArray(rows) ? rows : [];
}

function placeById(id: string): IndexPlace | undefined {
  if (!id || !PLACE_BY_ID) return undefined;
  return PLACE_BY_ID[id];
}

function toRef(p: IndexPlace): PlaceRef {
  return { tier: p.tier, id: p.id, slug: p.slug, code: p.code };
}

function iso2(code: string | undefined): string {
  const c = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
  return c.length === 2 ? c : '';
}

/** Every normalised key a row may be addressed by. */
function matchKeys(p: IndexPlace): string[] {
  const keys = [normPlace(p.name), normPlace((p.slug || '').replace(/-/g, ' '))];
  if (Array.isArray(p.aliases)) {
    for (const a of p.aliases) keys.push(normPlace(a));
  }
  return keys.filter(Boolean);
}

/** Rows of one tier matched by EXACT normalised equality on any signal. */
function exactTierMatches(
  rows: IndexPlace[],
  tier: PlaceTier,
  normSignals: string[],
): IndexPlace[] {
  const hits: IndexPlace[] = [];
  for (const row of rows) {
    if (row.tier !== tier) continue;
    const keys = matchKeys(row);
    if (normSignals.some((s) => keys.includes(s))) hits.push(row);
  }
  return hits;
}

/**
 * A usable coordinate pair, or null.
 *
 * (0, 0) is rejected on purpose: Null Island is what a supplier feed sends when
 * it has no coordinates at all, and order-to-booking maps the payload through
 * verbatim. Resolving a booking from it would put every such trip in the Gulf of
 * Guinea and, worse, could match a place row in a country that happens to be
 * near the origin.
 */
function validCoords(c: PlaceCoords | null | undefined): PlaceCoords | null {
  if (!c) return null;
  const lat = typeof c.lat === 'number' ? c.lat : NaN;
  const lng = typeof c.lng === 'number' ? c.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** resort beats city; country never competes here — it IS the fallback. */
const COORD_TIER_RANK: Record<PlaceTier, number> = { resort: 0, city: 1, country: 2 };

/**
 * The single nearest sub-country row to `coords` within COORD_RESOLVE_KM, or
 * null when nothing is close enough or the answer is ambiguous.
 *
 * `rows` is always ONE country's rows (PLACES_BY_COUNTRY[code]), and `code` is
 * denormalised onto every row at generation time, so a coordinate can never
 * pull a booking across a border no matter how close the foreign row is — the
 * guarantee is structural, not a distance check.
 */
function nearestByCoords(rows: IndexPlace[], coords: PlaceCoords): IndexPlace | null {
  const scored: Array<{ row: IndexPlace; km: number }> = [];
  for (const row of rows) {
    // The country row is the fallback this whole step sits in front of, and its
    // centroid is a capital city (USA → Washington DC), so it must never win on
    // distance.
    if (row.tier === 'country') continue;
    const c = validCoords({ lat: row.lat as number, lng: row.lng as number });
    if (!c) continue;
    const km = haversineKm(coords.lat, coords.lng, c.lat, c.lng);
    if (km <= COORD_RESOLVE_KM) scored.push({ row, km });
  }
  if (!scored.length) return null;

  scored.sort((a, b) => a.km - b.km);
  const nearest = scored[0].km;

  // Everything indistinguishably close to the winner, then the most specific
  // tier among them. Orlando and Florida carry the SAME centroid in the index,
  // so this is the step that returns the resort rather than the city.
  const comparable = scored.filter((s) => s.km - nearest <= COORD_AMBIGUOUS_KM);
  let best = COORD_TIER_RANK.country;
  for (const s of comparable) best = Math.min(best, COORD_TIER_RANK[s.row.tier]);
  const finalists = comparable.filter((s) => COORD_TIER_RANK[s.row.tier] === best);

  // Two neighbouring rows of the same tier, both plausible: not a match.
  return finalists.length === 1 ? finalists[0].row : null;
}

/** True when `row` IS `ancestorId` or sits below it in the parentId chain. */
function isSelfOrBelow(row: IndexPlace, ancestorId: string): boolean {
  if (!ancestorId) return false;
  let cur: IndexPlace | undefined = row;
  const seen = new Set<string>();
  // Three tiers, so three hops is the whole chain; the guard is for a snapshot
  // whose parentId links form a cycle rather than for a legitimate depth.
  while (cur && !seen.has(cur.id) && seen.size < 4) {
    if (cur.id === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.parentId ? placeById(cur.parentId) : undefined;
  }
  return false;
}

/**
 * Most specific Live place for this booking, or null.
 *
 * Order: resort tier by EXACT normalised name/slug/alias match on a signal →
 * city tier by the same → nearest row to `coords` within COORD_RESOLVE_KM →
 * explicit locationSlug (if it names an index row for `code`) → country tier for
 * `code`. Exact equality only on names: never substring, never token scoring. A
 * tie inside a tier is not a match at all.
 *
 * WHY COORDINATES. Name matching alone is literal, and suppliers do not send the
 * marketing name of a destination — they send the postal one. An attraction whose
 * location is 'Lake Buena Vista' (Walt Disney World's actual city) or 'Kissimmee'
 * matched NOTHING and fell all the way to {tier:'country', slug:'usa'}: no Orlando
 * record, no park guide, no Florida hero. Every attraction ticket already carries
 * lat/lng from the supplier payload and every index row carries a centroid, so the
 * geography answers what the words could not — and it does so without a
 * hand-maintained alias list that would need a human edit for every new suburb.
 * Coordinates run AFTER names because a name is an assertion about the place and a
 * coordinate is only a proximity, and BEFORE the country fallback because a coarse
 * page is what we are trying to stop being the answer.
 *
 * WHY A SIGNAL OUTRANKS locationSlug. `booking.locationSlug` is a HERO key, not
 * a content key (SHARED.md: it keeps its existing meaning — a roster slug the
 * pickers and the upload validator trust). matchLocationSlug walks an unrostered
 * resort up to the nearest ancestor that actually HAS an uploaded hero, so an
 * Orlando booking legitimately carries locationSlug 'florida'. While the slug was
 * an absolute override, that meant the Orlando record was never read: the
 * traveller got Florida's tagline, Miami and Key West events, Florida's Best For
 * Tags (Honeymoons/Beach/Summer Sun, which then drove honeymoon suggestions off
 * a theme-park trip) and NO park guide at all, because Walt Disney World,
 * Universal, SeaWorld and Discovery Cove are joined to the ORLANDO row while only
 * LEGOLAND and Busch Gardens hang off Florida.
 *
 * So the signal wins when it sits INSIDE the slug's own subtree — Orlando is a
 * child of Florida, so the signal is simply the more specific name for the same
 * place. A slug pointing somewhere else entirely is an agent's deliberate pick
 * and still wins over free text inferred from a supplier feed; and when signals
 * resolve nothing, or resolve ambiguously, the slug wins exactly as before.
 */
export function resolvePlaceRef(input: {
  countryCode: string;
  locationSlug?: string;
  signals: Array<string | null | undefined>;
  /** Where the trip actually happens — an attraction ticket's or hotel's
   *  lat/lng. Optional: every caller that has none behaves exactly as before. */
  coords?: PlaceCoords | null;
}): PlaceRef | null {
  const code = iso2(input.countryCode);
  if (!code) return null;

  const rows = placesInCountry(code);
  if (!rows.length) return null;

  const country = rows.find((r) => r.tier === 'country') ?? null;

  const slug = (input.locationSlug || '').toLowerCase().trim();
  const explicit = slug ? (rows.find((r) => r.slug === slug) ?? null) : null;

  const normSignals = Array.from(
    new Set((input.signals || []).map((s) => normPlace(s || '')).filter((s) => s.length >= 3)),
  );

  let matched: IndexPlace | null = null;
  if (normSignals.length) {
    for (const tier of ['resort', 'city'] as const) {
      const hits = exactTierMatches(rows, tier, normSignals);
      if (hits.length === 1) {
        matched = hits[0];
        break;
      }
      // Two rows in one country answering to the same words is not a match we
      // can pick between, and a wrong resort is worse than a coarse page — so an
      // ambiguous tier stops the signal search and leaves `matched` null.
      if (hits.length > 1) break;
    }
  }

  // Coordinates are a fallback, never a competitor: they are consulted only when
  // the words resolved nothing, so a name match always wins.
  const coords = validCoords(input.coords);
  const picked = matched ?? (coords ? nearestByCoords(rows, coords) : null);

  // Same subtree rule as before, now covering the coordinate hit too: an Orlando
  // row found by proximity is simply the more specific name for the 'florida'
  // hero slug the booking carries, so it wins; a hit somewhere else entirely
  // still loses to an agent's deliberate pick.
  if (picked && (!explicit || isSelfOrBelow(picked, explicit.id))) return toRef(picked);
  if (explicit) return toRef(explicit);

  return country ? toRef(country) : null;
}

/** Ancestor chain by `parentId`, most specific first. Missing links truncate. */
export function ancestorRefs(ref: PlaceRef): {
  resort: PlaceRef | null;
  city: PlaceRef | null;
  country: PlaceRef | null;
} {
  const out: { resort: PlaceRef | null; city: PlaceRef | null; country: PlaceRef | null } = {
    resort: null,
    city: null,
    country: null,
  };
  let row = placeById(ref.id);
  const seen = new Set<string>();
  // Three tiers, so three hops is the whole chain; the guard is for a snapshot
  // whose parentId links form a cycle rather than for a legitimate depth.
  while (row && !seen.has(row.id) && seen.size < 4) {
    seen.add(row.id);
    if (!out[row.tier]) out[row.tier] = toRef(row);
    row = row.parentId ? placeById(row.parentId) : undefined;
  }
  return out;
}

/** Ancestor rows for a ref, self first, broadest last. */
function chainRows(ref: PlaceRef | null): IndexPlace[] {
  if (!ref) return [];
  const rows: IndexPlace[] = [];
  let row = placeById(ref.id);
  const seen = new Set<string>();
  while (row && !seen.has(row.id) && seen.size < 4) {
    seen.add(row.id);
    rows.push(row);
    row = row.parentId ? placeById(row.parentId) : undefined;
  }
  return rows;
}

/** First ancestor (self included) whose index row has hasHero, else undefined.
 *  Orlando → 'florida'. Synchronous by contract: hero.ts never awaits. */
export function heroSlugFor(ref: PlaceRef | null): string | undefined {
  for (const row of chainRows(ref)) {
    if (row.hasHero && row.slug) return row.slug;
  }
  return undefined;
}

/** Park record ids joined to any tier of the chain, deduped, capped at `limit`
 *  (default 8), most-specific tier first. */
export function parkIdsForChain(ref: PlaceRef, limit = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of chainRows(ref)) {
    const ids = PARKS_BY_PLACE ? PARKS_BY_PLACE[row.id] : undefined;
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Index rows for a list of Airtable record ids, order preserved, unknown
 *  ids dropped. Used to resolve "Best Paired With" link cells. */
export function placesByIds(ids: string[]): IndexPlace[] {
  const out: IndexPlace[] = [];
  const seen = new Set<string>();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const row = placeById(id);
    if (row) out.push(row);
  }
  return out;
}

const TIER_RANK: Record<PlaceTier, number> = { city: 0, resort: 1, country: 2 };

/**
 * Cross-country tag-similarity candidates, for "Where next?".
 * Scores |shared tags|, excludes `ref`'s own country, prefers city tier,
 * requires >= 2 shared tags, returns at most `limit` (default 6).
 */
export function similarPlaces(input: {
  ref: PlaceRef;
  tags: string[];
  limit?: number;
}): Array<{ place: IndexPlace; sharedTags: string[] }> {
  const limit = input.limit ?? 6;
  const own = new Map<string, string>();
  for (const t of Array.isArray(input.tags) ? input.tags : []) {
    const n = normPlace(t);
    if (n) own.set(n, t);
  }
  if (own.size < 2) return [];

  const code = iso2(input.ref.code);
  const scored: Array<{ place: IndexPlace; sharedTags: string[] }> = [];
  for (const row of allPlaces()) {
    if (row.code === code || row.id === input.ref.id) continue;
    const shared: string[] = [];
    for (const t of Array.isArray(row.tags) ? row.tags : []) {
      const hit = own.get(normPlace(t));
      if (hit && !shared.includes(hit)) shared.push(hit);
    }
    if (shared.length >= 2) scored.push({ place: row, sharedTags: shared });
  }

  scored.sort((a, b) => {
    if (b.sharedTags.length !== a.sharedTags.length) return b.sharedTags.length - a.sharedTags.length;
    const rank = TIER_RANK[a.place.tier] - TIER_RANK[b.place.tier];
    if (rank !== 0) return rank;
    return a.place.name.localeCompare(b.place.name);
  });

  return scored.slice(0, limit);
}

/** Display-name ancestry for an index row, broadest last, excluding self. */
export function ancestryNames(place: IndexPlace): string[] {
  const rows = chainRows(toRef(place));
  return rows.slice(1).map((r) => r.name).filter(Boolean);
}

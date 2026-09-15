/**
 * Attraction ticket → theme park matching. PURE and isomorphic.
 *
 * Deliberately CONSERVATIVE, on the same grounds as location-match.ts: a ticket
 * that ends up unmatched costs the traveller a panel they never saw. Attaching
 * Disney's height restrictions to an airport transfer is a factual error in
 * front of a paying client, so every guard here fails towards "no match".
 */

import type { ParkRecord } from '@/types/destination-content';

/** Supplier placeholders and generic words that NEVER match a park.
 *  order-to-booking.ts:422 literally falls back to the title "Attraction ticket". */
export const STOP_TITLES: ReadonlySet<string> = new Set([
  'attraction ticket',
  'attraction tickets',
  'attractions',
  'ticket',
  'tickets',
  'entrance ticket',
  'entrance tickets',
  'admission',
  'day trip',
  'excursion',
  'excursions',
  'activity',
  'experience',
  'tour',
  'transfer',
  'transfers',
  'car hire',
  'theme park ticket',
  'theme park tickets',
  'park ticket',
  'park tickets',
  'other',
]);

// Same normalisation as place-index's normPlace, deliberately duplicated rather
// than imported: this module runs in the browser, and place-index pulls the
// whole ~900-row generated snapshot in with it.
function norm(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const MAX_PARK_MATCH_KM = 40;
export const RESCUE_PARK_MATCH_KM = 3;

/**
 * How close the two coordinates must be before a name match may CLAIM that the
 * coordinates corroborated it — i.e. before `matchedBy` is allowed to say
 * 'name+coords' rather than plain 'name'.
 *
 * WHY THIS EXISTS: the label used to be set by `!!expCoords && hasCoords(park)`,
 * so it meant nothing more than "both sides happened to carry numbers". A
 * SeaWorld ticket pinned 29.9 km from SeaWorld — the far side of Orlando, and
 * only inside the 40 km VETO because that veto is deliberately loose — still
 * came back as 'name+coords'. Anything downstream reading that label as evidence
 * the coordinates agreed (a confidence chip, a drift log, a future auto-accept)
 * was being told something untrue by a value that is supposed to be provenance.
 *
 * WHY 10 km AND NOT THE 40 km VETO: the veto and the corroboration are answering
 * different questions. The veto asks "could this possibly be the same
 * attraction?" and must stay generous, because an experience's coordinate is
 * often a meeting point or a pickup hotel rather than the gate. Corroboration
 * asks "did the coordinates independently confirm the name?", which is only true
 * inside one property. Walt Disney World Resort is itself roughly 10 km across,
 * so 10 km is the smallest radius that still covers a ticket pinned at one of a
 * resort's own parks against the resort's centroid, and the largest that cannot
 * quietly span a whole metro area.
 *
 * Failing this test NEVER rejects a match — it only downgrades the label to
 * 'name', which is exactly what the match actually was.
 */
export const CORROBORATE_PARK_MATCH_KM = 10;

export interface ParkMatch {
  experienceId: string;
  park: ParkRecord;
  matchedBy: 'name' | 'name+coords' | 'coords';
}

// Words that carry no identity on their own — "Resort transfer" must not reach
// "Universal Orlando Resort".
const TOKEN_STOPWORDS = new Set([
  'resort', 'resorts', 'park', 'parks', 'theme', 'water', 'gardens', 'garden',
  'world', 'island', 'islands', 'centre', 'center', 'entrance', 'ticket',
  'tickets', 'adventure', 'adventures', 'studios', 'studio', 'attraction',
  'attractions', 'experience', 'holiday', 'holidays', 'family', 'grand',
]);

// Generic tails a park name often ends with; stripping them yields a second
// phrase key so "Walt Disney World 14-Day Ultimate Ticket" can still reach
// "Walt Disney World Resort" by phrase as well as by token.
const GENERIC_TAILS = new Set(['resort', 'resorts', 'park', 'parks', 'theme park']);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** needle appears in haystack as a whole word / phrase (at word boundaries). */
function containsWhole(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${escapeRe(needle)}($|\\s)`).test(haystack);
}

/** Exact keys (whole normalised names) and candidate distinctive keys. */
function parkKeys(park: ParkRecord): { exact: string[]; distinctive: string[]; text: string } {
  const names = [park.name, park.slug ? park.slug.replace(/-/g, ' ') : ''];
  const exact: string[] = [];
  const distinctive: string[] = [];
  const texts: string[] = [];

  for (const raw of names) {
    const n = norm(raw || '');
    if (!n) continue;
    if (!exact.includes(n)) exact.push(n);
    if (!texts.includes(n)) texts.push(n);

    const words = n.split(' ');
    while (words.length > 1 && GENERIC_TAILS.has(words[words.length - 1])) {
      words.pop();
      const trimmed = words.join(' ');
      if (trimmed && !distinctive.includes(trimmed)) distinctive.push(trimmed);
    }

    for (const w of n.split(' ')) {
      if (w.length >= 5 && !TOKEN_STOPWORDS.has(w) && !distinctive.includes(w)) {
        distinctive.push(w);
      }
    }
  }
  // Joined with a separator that is not whitespace, so a phrase key can never
  // straddle the name/slug boundary and count as a false extra occurrence.
  return { exact, distinctive, text: texts.join(' | ') };
}

interface Candidate {
  park: ParkRecord;
  exact: string[];
  /** Keys that describe exactly ONE park in this candidate list. */
  distinctive: string[];
}

/**
 * Build the match keys for a candidate list, dropping every "distinctive" key
 * that in fact describes more than one candidate.
 *
 * WHY: a hand-maintained stopword list cannot know that "orlando" is worthless
 * here. Universal Orlando Resort, SeaWorld Orlando and Discovery Cove Orlando
 * all carry it, so it separates nothing — yet it is 7 characters and not a
 * stopword, so the old code let all three parks answer to "Universal Orlando
 * 3-Park Explorer Ticket" and then threw the ticket away as ambiguous. A token
 * shared by several candidates carries no information; one unique to a single
 * candidate carries all of it. Deriving that from the list itself generalises
 * for free to "paris", "dubai" and "tokyo" — no list to maintain, and it adapts
 * when a fifth Orlando park is added.
 */
function buildCandidates(list: ParkRecord[]): Candidate[] {
  const raw = list.map((park) => ({ park, ...parkKeys(park) }));
  return raw.map((c) => ({
    park: c.park,
    exact: c.exact,
    // Document frequency over the candidates' own name text, so phrases are
    // measured the same way tokens are ("universal orlando" → 1, "orlando" → 3).
    distinctive: c.distinctive.filter(
      (key) => raw.filter((other) => containsWhole(other.text, key)).length === 1,
    ),
  }));
}

function hasCoords(v: { lat?: number; lng?: number }): v is { lat: number; lng: number } {
  return typeof v.lat === 'number' && Number.isFinite(v.lat)
    && typeof v.lng === 'number' && Number.isFinite(v.lng);
}

/** Great-circle km. Corroboration gate only, never a ranking signal. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * The single tied park the experience is sitting on, or null.
 *
 * Matches only when the nearest tied park is inside RESCUE_PARK_MATCH_KM and
 * every other tied park is outside it — "on top of this one, and nowhere near
 * the others". Anything less separated is left unmatched.
 */
function tieBreakByCoords(
  tied: ParkRecord[],
  expCoords: { lat: number; lng: number } | null,
): ParkRecord | null {
  if (!expCoords) return null;
  // A tied park with no coordinates could be anywhere, so it can never be ruled
  // out — which means the tie cannot be broken at all. Fail towards no match.
  if (!tied.every(hasCoords)) return null;

  const ranked = tied
    .map((p) => ({ park: p, km: haversineKm(expCoords.lat, expCoords.lng, p.lat!, p.lng!) }))
    .sort((a, b) => a.km - b.km);

  if (ranked[0].km > RESCUE_PARK_MATCH_KM) return null;
  if (ranked[1] && ranked[1].km <= RESCUE_PARK_MATCH_KM) return null;
  return ranked[0].park;
}

/**
 * Conservative by construction:
 *  - name gate: normalised equality with Name/alias, or one distinctive token
 *    (>= 5 chars, word boundary, not a stopword, and describing exactly ONE park
 *    in this candidate list) — the location-match discipline;
 *  - coordinate VETO: both sides have coords and are > MAX_PARK_MATCH_KM apart
 *    ⇒ REJECT even when the name scored;
 *  - coordinate CORROBORATION: a lone name match is reported as 'name+coords'
 *    only when both sides have coords AND they are within
 *    CORROBORATE_PARK_MATCH_KM — otherwise it is what it is, a 'name' match.
 *    Merely carrying coordinates is not agreement between them;
 *  - coordinate TIE-BREAK: several parks tie on name but the experience sits
 *    within RESCUE_PARK_MATCH_KM of exactly one of them ⇒ match, 'name+coords';
 *  - coordinate RESCUE: name fails but the experience is within
 *    RESCUE_PARK_MATCH_KM of exactly one candidate ⇒ match, matchedBy 'coords';
 *  - ambiguity ⇒ NOTHING: two parks tie on name and coords do not separate them,
 *    neither is "your park"; both fall into `nearby`.
 * Unmatched parks are never discarded — they come back as `nearby`.
 */
export function matchTicketsToParks(
  experiences: Array<{ id: string; title: string; lat?: number; lng?: number }>,
  parks: ParkRecord[],
): { matched: ParkMatch[]; nearby: ParkRecord[] } {
  const list = Array.isArray(parks) ? parks : [];
  const matched: ParkMatch[] = [];
  const claimed = new Set<string>();
  // Keys depend on the whole candidate list (see buildCandidates), so they are
  // computed once here rather than per park per experience.
  const candidates = buildCandidates(list);

  for (const exp of Array.isArray(experiences) ? experiences : []) {
    if (!exp || !exp.id) continue;
    const title = norm(exp.title || '');
    if (!title || STOP_TITLES.has(title)) continue;

    const expCoords = hasCoords(exp) ? exp : null;

    // The separation is carried alongside the park, not recomputed later: it is
    // what decides whether this match may claim coordinate corroboration, and
    // `null` means "one side had no coordinates", which is not the same as 0 km.
    const named: Array<{ park: ParkRecord; km: number | null }> = [];
    for (const { park, exact, distinctive } of candidates) {
      const hit =
        exact.includes(title) ||
        exact.some((k) => containsWhole(title, k)) ||
        distinctive.some((k) => k.length >= 5 && containsWhole(title, k));
      if (!hit) continue;

      let km: number | null = null;
      if (expCoords && hasCoords(park)) {
        km = haversineKm(expCoords.lat, expCoords.lng, park.lat, park.lng);
        // Coordinate VETO — a name that scored but sits 40 km away is a different
        // attraction with a similar name, not this one.
        if (km > MAX_PARK_MATCH_KM) continue;
      }
      named.push({ park, km });
    }

    if (named.length === 1) {
      const { park, km } = named[0];
      // 'name+coords' is a PROVENANCE claim that the coordinates agreed, so it is
      // only made when they actually did. Both sides merely carrying numbers —
      // the old test — labelled a ticket 29.9 km from its park as corroborated.
      const corroborated = km !== null && km <= CORROBORATE_PARK_MATCH_KM;
      matched.push({
        experienceId: exp.id,
        park,
        matchedBy: corroborated ? 'name+coords' : 'name',
      });
      claimed.add(park.id);
      continue;
    }
    if (named.length > 1) {
      // Several parks answer to the same words. Coordinates get to BREAK the
      // tie before the ticket is discarded: a ticket sitting ON one of the tied
      // parks, with every other tied park clearly further away, is not
      // ambiguous at all. (The old code discarded it unread, which is how an
      // Orlando ticket 0.00 km from Universal ended up matching nothing.)
      // "Clearly further" = outside the tight rescue radius, so SeaWorld and
      // Discovery Cove — 0.14 km apart — still separate to NOTHING.
      // Honest by construction: this branch only ever returns a park the
      // experience is sitting within RESCUE_PARK_MATCH_KM of, which is well
      // inside CORROBORATE_PARK_MATCH_KM, so 'name+coords' is earned here.
      const tie = tieBreakByCoords(named.map((n) => n.park), expCoords);
      if (tie) {
        matched.push({ experienceId: exp.id, park: tie, matchedBy: 'name+coords' });
        claimed.add(tie.id);
      }
      // No coordinates, or coordinates that do not separate them ⇒ neither is
      // "your park". Both stay in `nearby`. Never guess.
      continue;
    }

    if (expCoords) {
      const close = list.filter(
        (p) =>
          hasCoords(p) &&
          haversineKm(expCoords.lat, expCoords.lng, p.lat, p.lng) <= RESCUE_PARK_MATCH_KM,
      );
      if (close.length === 1) {
        matched.push({ experienceId: exp.id, park: close[0], matchedBy: 'coords' });
        claimed.add(close[0].id);
      }
    }
  }

  return { matched, nearby: list.filter((p) => !claimed.has(p.id)) };
}

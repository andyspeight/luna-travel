/**
 * Best-effort location matcher for auto-synced bookings.
 *
 * A Travelify/Control booking has no human "pick the area" step, so we infer a
 * location slug from what the order tells us — hotel cities and the destination
 * label — and use it to choose a location-specific hero.
 *
 * Deliberately CONSERVATIVE: a wrong city photo is worse than the country
 * fallback. So exact name matches always win; a partial match only fires on a
 * distinctive token (>= 5 chars, not a generic geography word) and at a word
 * boundary. Matching is scoped to the booking's OWN country, so a false
 * cross-country match is impossible.
 *
 * LAST RESORT (only when the scorer above found nothing): the roster is a
 * snapshot of Cities and Regions, so it has no row for a resort or area. An
 * Orlando booking therefore scored 0 against "Florida" — the relationship
 * between the two is an Airtable parent link, not a name similarity, and no
 * threshold could ever recover it. So an unscored signal is looked up in the
 * generated place index, which does carry that link, and resolved to the
 * nearest ancestor that actually has an uploaded hero: Orlando → Florida.
 * The result is re-checked with isKnownLocation(), so this function can still
 * only ever return a roster slug — the pickers, the upload validator and the
 * hero path all keep their existing guarantees.
 */

import { HERO_LOCATIONS_BY_COUNTRY, isKnownLocation } from '@/data/hero-locations';
import { normPlace, resolvePlaceRef, heroSlugFor } from '@/lib/place-index';

// Generic geography words that must never trigger a match on their own.
const STOPWORDS = new Set([
  'coast', 'north', 'south', 'east', 'west', 'central', 'region', 'area', 'areas',
  'island', 'islands', 'city', 'town', 'bay', 'beach', 'beaches', 'riviera', 'valley',
  'alps', 'peninsula', 'lakes', 'lake', 'highlands', 'national', 'park', 'sacred',
  'grand', 'greater', 'golden', 'triangle', 'and', 'the', 'los', 'las', 'del', 'de', 'la',
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** needle appears in haystack as a whole word / phrase (at word boundaries). */
function containsWhole(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${escapeRe(needle)}($|\\s)`).test(haystack);
}

interface Key { key: string; weight: number }

/** Distinctive phrases + words from a location's name and slug. */
function candidateKeys(name: string, slug: string): Key[] {
  const phrases: string[] = [];
  for (const part of name.split(/[&,/]/)) {
    const n = normPlace(part.replace(/\bthe\b/gi, ''));
    if (n) phrases.push(n);
  }
  const slugPhrase = normPlace(slug.replace(/-/g, ' '));
  if (slugPhrase) phrases.push(slugPhrase);

  const keys: Key[] = [];
  const seen = new Set<string>();
  for (const p of phrases) {
    if (p.length >= 3 && !seen.has(p)) { seen.add(p); keys.push({ key: p, weight: 2 }); }
    for (const w of p.split(' ')) {
      if (w.length >= 4 && !STOPWORDS.has(w) && !seen.has(w)) { seen.add(w); keys.push({ key: w, weight: 1 }); }
    }
  }
  return keys;
}

const MIN_SCORE = 5;

/**
 * Best-matching location slug for a country + destination signals, or undefined
 * when nothing matches confidently.
 */
export function matchLocationSlug(
  countryCode: string | undefined,
  signals: Array<string | null | undefined>,
): string | undefined {
  const code = (countryCode || '').toUpperCase();
  const locs = HERO_LOCATIONS_BY_COUNTRY[code];
  if (!locs || !locs.length) return undefined;

  const normSignals = Array.from(
    new Set(signals.map((s) => normPlace(s || '')).filter((s) => s.length >= 3)),
  );
  if (!normSignals.length) return undefined;

  let bestSlug: string | undefined;
  let bestScore = 0;
  for (const loc of locs) {
    const keys = candidateKeys(loc.name, loc.slug);
    let score = 0;
    for (const s of normSignals) {
      for (const { key, weight } of keys) {
        if (s === key) {
          score = Math.max(score, 100 + key.length * weight); // exact — always wins
        } else if (key.length >= 5 && containsWhole(s, key)) {
          score = Math.max(score, key.length * weight);        // partial — distinctive tokens only
        }
      }
    }
    if (score > bestScore) { bestScore = score; bestSlug = loc.slug; }
  }
  if (bestScore >= MIN_SCORE) return bestSlug;

  // Last resort: a child place (resort/area) whose PARENT city is in the
  // roster. Exact equality on a whole normalised signal only — the scorer above
  // is untouched, so every booking that matches today matches identically.
  for (const s of normSignals) {
    const ref = resolvePlaceRef({ countryCode: code, signals: [s] });
    if (!ref || ref.tier === 'country') continue;
    const slug = heroSlugFor(ref);
    if (slug && isKnownLocation(code, slug)) return slug;
  }
  return undefined;
}

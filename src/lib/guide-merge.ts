/**
 * Destination guide precedence. PURE and client-safe.
 *
 * THE one place the three-source order is expressed, replacing the inline
 * `brain?.x || guide.x` chains that were scattered across the destination page.
 * A single global order gets it wrong, so precedence is split by field family:
 * Luna Brain alone carries Source + Confidence + Last Verified, so it wins the
 * legal/safety facts; place content is the only layer with a city tier, so it
 * wins character and local practicality — which is what stops a country-level
 * US time zone beating Florida's.
 *
 * Nothing is defaulted or invented. Every field is optional, so the page renders
 * for a country with no static guide at all, hiding what it does not have.
 */

import type { DestinationGuide } from '@/types/booking';
import type {
  PlaceSectionKey,
  PlaceTier,
  PlaceView,
} from '@/types/destination-content';

/** Every field optional — this is what lets the page render for a country with
 *  no static guide. Nothing is ever defaulted or invented. */
export interface ResolvedGuide {
  countryCode: string;
  name?: string;
  /** Hero eyebrow: PlaceView.breadcrumb, else guide.region. */
  region?: string;
  tagline?: string;
  introduction?: string;
  whyWeLoveIt?: string;
  currency?: string;
  timeZone?: string;
  languages?: string;
  voltageAndPlug?: string;
  flightTimeFromUK?: string;
  weatherSummary?: string;
  emergencyNumber?: string;
  visaSummary?: string;
  insiderTips?: string;
  /** Which layer supplied the headline prose — drives the attribution line. */
  source: 'content' | 'brain' | 'static' | 'none';
  /** Per-field attribution for the values that came from place content. */
  sourceOf: Partial<Record<keyof ResolvedGuide, PlaceTier>>;
}

type StringField = Exclude<keyof ResolvedGuide, 'source' | 'sourceOf' | 'countryCode'>;

function text(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ');
  return '';
}

/** Most specific section body for any of `keys`, with its tier. Sections arrive
 *  most-specific-first, so the first hit is the most specific. */
function section(
  place: PlaceView | null,
  keys: PlaceSectionKey[],
): { body: string; tier: PlaceTier } | null {
  if (!place || !Array.isArray(place.sections)) return null;
  for (const s of place.sections) {
    if (keys.includes(s.key) && s.body) return { body: s.body, tier: s.tier };
  }
  return null;
}

/** Country-tier section only — the verified-fact family may never be answered
 *  by a resort's marketing copy. */
function countrySection(
  place: PlaceView | null,
  keys: PlaceSectionKey[],
): { body: string; tier: PlaceTier } | null {
  if (!place || !Array.isArray(place.sections)) return null;
  for (const s of place.sections) {
    if (s.tier === 'country' && keys.includes(s.key) && s.body) {
      return { body: s.body, tier: s.tier };
    }
  }
  return null;
}

/**
 * PRECEDENCE, split by field family (a single global order gets it wrong):
 *
 *  CHARACTER / PLACE   tagline, introduction (Hero Intro → Overview),
 *  whyWeLoveIt (What Makes It Special / Character and Vibe), region, insiderTips:
 *      place content (resort > city > country) > static DestinationGuide
 *      (Luna Brain has no city tier, so it never competes here)
 *
 *  VERIFIED FACT       visaSummary, emergencyNumber, plus the FCDO/vaccination/
 *  embassy values the page reads straight off `brain`:
 *      Luna Brain (country) > place content country tier > static
 *      (Brain alone carries Source + Confidence + Last Verified)
 *
 *  LOCAL PRACTICALITY  currency, timeZone, languages, voltageAndPlug,
 *  flightTimeFromUK, weatherSummary:
 *      place content (resort > city > country) > Luna Brain (country) > static
 *      (deliberately inverted against Brain: this is the fix for a country-level
 *       US time zone beating Florida's)
 */
export function resolveGuide(args: {
  countryCode: string;
  place: PlaceView | null;
  brain: { destination?: Record<string, unknown> } | null;
  staticGuide: DestinationGuide | undefined;
}): ResolvedGuide {
  const place = args.place ?? null;
  const dest = args.brain?.destination ?? null;
  const stat = args.staticGuide;

  const out: ResolvedGuide = {
    countryCode: (args.countryCode || '').toUpperCase(),
    source: 'none',
    sourceOf: {},
  };

  // Every field this writes is a `string | undefined` one; the cast is only to
  // let one helper record the value and its tier together.
  const fromPlace = (field: StringField, value: string, tier: PlaceTier) => {
    (out as unknown as Record<string, string>)[field] = value;
    out.sourceOf[field] = tier;
  };

  // ── Character / place ──
  const intro = section(place, ['hero-intro', 'overview']);
  if (intro) fromPlace('introduction', intro.body, intro.tier);
  else if (stat?.introduction) out.introduction = stat.introduction;

  const love = section(place, ['what-makes-it-special', 'character']);
  if (love) fromPlace('whyWeLoveIt', love.body, love.tier);
  else if (stat?.whyWeLoveIt) out.whyWeLoveIt = stat.whyWeLoveIt;

  if (place?.tagline?.value) fromPlace('tagline', place.tagline.value, place.tagline.tier);

  if (place?.breadcrumb) out.region = place.breadcrumb;
  else if (place?.region?.value) fromPlace('region', place.region.value, place.region.tier);
  else if (stat?.region) out.region = stat.region;

  // The closest thing place content has to "insider tips" is a country's
  // Practical Info; a resort's marketing prose is not that, so nothing else maps.
  const practical = countrySection(place, ['practical']);
  if (practical) fromPlace('insiderTips', practical.body, practical.tier);
  else if (stat?.insiderTips) out.insiderTips = stat.insiderTips;

  // ── Verified fact — Luna Brain first ──
  const brainVisa = text(dest?.ukVisaRequired) || text(dest?.visaSummary);
  const placeVisa = countrySection(place, ['visa']);
  if (brainVisa) out.visaSummary = brainVisa;
  else if (placeVisa) fromPlace('visaSummary', placeVisa.body, placeVisa.tier);
  else if (stat?.visaSummary) out.visaSummary = stat.visaSummary;

  const brainEmergency = text(dest?.emergencyNumber);
  if (brainEmergency) out.emergencyNumber = brainEmergency;
  else if (stat?.emergencyNumber) out.emergencyNumber = stat.emergencyNumber;

  // ── Local practicality — place content first ──
  const facts = place?.facts;

  if (facts?.currency?.value) fromPlace('currency', facts.currency.value, facts.currency.tier);
  else if (text(dest?.currency)) out.currency = text(dest?.currency);
  else if (stat?.currency) out.currency = stat.currency;

  if (facts?.timeZone?.value) fromPlace('timeZone', facts.timeZone.value, facts.timeZone.tier);
  else if (text(dest?.timeZone)) out.timeZone = text(dest?.timeZone);
  else if (stat?.timeZone) out.timeZone = stat.timeZone;

  if (facts?.language?.value) fromPlace('languages', facts.language.value, facts.language.tier);
  else if (text(dest?.languages)) out.languages = text(dest?.languages);
  else if (stat?.languages?.length) out.languages = stat.languages.join(', ');

  if (facts?.voltageAndPlug?.value) {
    fromPlace('voltageAndPlug', facts.voltageAndPlug.value, facts.voltageAndPlug.tier);
  } else {
    const plug = [text(dest?.voltage), text(dest?.plugType)].filter(Boolean).join(' · ');
    if (plug) out.voltageAndPlug = plug;
  }

  if (facts?.flightTimeFromUK?.value) {
    fromPlace('flightTimeFromUK', facts.flightTimeFromUK.value, facts.flightTimeFromUK.tier);
  }

  // "Best time to visit" is the place's own weather/when-to-go prose; Brain's
  // best-months is the country-level equivalent.
  const bestTime = section(place, ['best-time']);
  if (bestTime) fromPlace('weatherSummary', bestTime.body, bestTime.tier);
  else if (text(dest?.bestMonths)) out.weatherSummary = text(dest?.bestMonths);
  else if (stat?.weatherSummary) out.weatherSummary = stat.weatherSummary;

  // ── Name + attribution ──
  out.name = place?.name || text(dest?.name) || stat?.name || undefined;

  if (intro) out.source = 'content';
  else if (stat?.introduction) out.source = 'static';
  else if (dest && Object.values(dest).some((v) => !!text(v))) out.source = 'brain';
  else if (place) out.source = 'content';
  else out.source = 'none';

  return out;
}

/**
 * The fields whose presence means there is something worth rendering.
 *
 * `name` and `region` are DELIBERATELY EXCLUDED. resolveGuide sets `region`
 * from place.breadcrumb and `name` from place.name for every place that
 * resolves at all, and both are derived from the record's primary field, which
 * is never empty. Including them made isEmptyGuide unable to return true once
 * any place resolved — and because resolvePlaceRef falls back to the country
 * tier for every booking whose country has a row (108 Live country rows in the
 * index), a thin country record with nothing but a name rendered the full hero,
 * the tab bar and an Overview tab with no intro, no highlights, no prose, no
 * climate and no facts under it. The honest "coming soon" line was unreachable.
 * Emptiness is judged on prose and facts only: a guide that has a breadcrumb
 * and nothing else IS empty.
 */
const RENDERED_FIELDS: Array<keyof ResolvedGuide> = [
  'tagline', 'introduction', 'whyWeLoveIt', 'currency',
  'timeZone', 'languages', 'voltageAndPlug', 'flightTimeFromUK',
  'weatherSummary', 'emergencyNumber', 'visaSummary', 'insiderTips',
];

/** True when there is genuinely nothing to render. The ONLY condition that may
 *  show "coming soon", and only once loading has settled. */
export function isEmptyGuide(g: ResolvedGuide): boolean {
  if (!g) return true;
  return !RENDERED_FIELDS.some((f) => !!text(g[f]));
}

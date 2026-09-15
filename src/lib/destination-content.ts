/**
 * Destination Content adapter — read-only.
 *
 * Reads the editorial place records (Countries, Cities and Regions, Resorts and
 * Areas, Theme Parks and Attractions) from the Destination Content Airtable base
 * (appuZdlMJ7HKUt6qS) that Travelgenix authors. Server-only: uses AIRTABLE_KEY
 * (the same key as src/lib/travelify.ts and src/lib/luna-brain.ts).
 * NEVER import this from a client component.
 *
 * WHICH record describes a trip is answered for free by the generated snapshot
 * in src/data/destination-places.ts (see src/lib/place-index.ts). This module
 * only answers WHAT IS IN those records, so every upstream call is a record-id
 * GET — no filterByFormula, therefore no formula-injection surface on the
 * content path, and Florida's city record is fetched once and reused by every
 * Orlando, Miami and Keys booking.
 *
 * Data-integrity (travelgenix-security): Status is re-checked at read time so
 * draft editorial can never reach a traveller through a stale index; a cell that
 * does not parse hides its own block rather than being paraphrased or padded;
 * and a partial upstream failure degrades to the tiers that answered.
 */

import {
  ancestorRefs,
  ancestryNames,
  heroSlugFor,
  parkIdsForChain,
  placesByIds,
  resolvePlaceRef,
  similarPlaces,
  type IndexPlace,
  type PlaceRef,
} from '@/lib/place-index';
import { PARK_BY_SLUG, PARK_INDEX } from '@/data/destination-places';
import {
  parseClimateRow,
  parseClimateSeasons,
  parseMonthToken,
} from '@/lib/destination-dates';
import type {
  ClimateBand,
  Highlight,
  HighlightIcon,
  ParkRecord,
  PlaceEvent,
  PlaceFact,
  PlaceImage,
  PlaceSection,
  PlaceSectionKey,
  PlaceSuggestion,
  PlaceTier,
  PlaceView,
} from '@/types/destination-content';

const CONTENT_BASE = 'appuZdlMJ7HKUt6qS';
const T_COUNTRIES = 'tblsxbqbyhTDoWhbo';
const T_CITIES = 'tblTkKujdVZgWPAQe';
const T_RESORTS = 'tblwV9gnbVEyZ99gI';
const T_PARKS = 'tblhVDUdpwaLabDmQ';
const AIRTABLE_V0 = 'https://api.airtable.com/v0';

const TABLE_FOR_TIER: Record<PlaceTier, string> = {
  country: T_COUNTRIES,
  city: T_CITIES,
  resort: T_RESORTS,
};

/** Publish predicates — the ONLY place the Status vocabularies are encoded.
 *  Parks differ: every Orlando row is 'Published', not 'Live'. */
export const PLACE_LIVE_STATUSES: ReadonlySet<string> = new Set(['Live']);
export const PARK_LIVE_STATUSES: ReadonlySet<string> = new Set(['Live', 'Published']);

const REC_ID = /^rec[A-Za-z0-9]{14}$/;
const FETCH_TIMEOUT_MS = 4000;
const TOTAL_BUDGET_MS = 6000;
const TTL_MS = 900_000;
const STALE_HORIZON_MS = 86_400_000;
const MEMO_CAP = 500;
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;
const MAX_HIGHLIGHTS = 6;
const MAX_SUGGESTIONS = 6;

// Airtable rate-limits a base at 5 requests per second and then refuses it for
// 30 seconds. A cold place read is a burst — tiers, then parks, then taglines —
// so each stage is drained through a small pool rather than started eagerly.
// Two at a time keeps the whole chain comfortably under the limit even when two
// travellers open the same uncached place at once, which is how the original
// eager fan-out of 9-11 simultaneous GETs managed to 429 itself.
const TIER_CONCURRENCY = 2;
const PARK_CONCURRENCY = 2;
const SUGGESTION_CONCURRENCY = 2;

// How many joined parks a place may carry. The cap exists to bound the Airtable
// burst, but a cap is the wrong instrument for that: PARK_CONCURRENCY already
// bounds the spike and the shared deadline bounds the wall clock, so a longer
// list costs more time-under-budget, never a bigger burst. It is sized to clear
// the biggest real chain in the index rather than a round number — the United
// Kingdom country row links THIRTEEN parks, which is why 12 still lost Warwick
// Castle exactly as 4 lost LEGOLAND Florida. Truncation is logged, never silent.
const MAX_PARKS = 20;
/** Suggestion taglines are a nice-to-have on a card that already has a name and
 *  a photo, so they get a small cap and their own short sub-budget: they must
 *  never be the reason the guide itself is late. Three PER RAIL, so the leading
 *  cards of both "Add a few days" and "Where next?" carry their hook rather than
 *  one rail taking every slot. */
const MAX_TAGLINE_READS_PER_RAIL = 3;
const TAGLINE_BUDGET_MS = 1500;

/** True when AIRTABLE_KEY is present. Mirrors brainConfigured(). */
export function destinationContentConfigured(): boolean {
  return !!process.env.AIRTABLE_KEY;
}

// ───────── Airtable REST (record-id GETs only) ─────────

type AirtableRecord = { id: string; fields: Record<string, unknown> };

interface MemoEntry {
  at: number;
  value: AirtableRecord | null;
}

const memo = new Map<string, MemoEntry>();
const inflight = new Map<string, Promise<AirtableRecord | null>>();

let breakerFailures = 0;
let breakerOpenUntil = 0;

function breakerOpen(): boolean {
  return Date.now() < breakerOpenUntil;
}

function noteFailure(): void {
  breakerFailures += 1;
  if (breakerFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
    breakerFailures = 0;
  }
}

function noteSuccess(): void {
  breakerFailures = 0;
  breakerOpenUntil = 0;
}

function remember(key: string, value: AirtableRecord | null): void {
  if (memo.size >= MEMO_CAP && !memo.has(key)) {
    // Map preserves insertion order, so the first key is the oldest write.
    const oldest = memo.keys().next();
    if (!oldest.done) memo.delete(oldest.value);
  }
  memo.set(key, { at: Date.now(), value });
}

export class ContentUnavailableError extends Error {}

async function fetchRecord(table: string, recId: string): Promise<AirtableRecord | null> {
  const key = process.env.AIRTABLE_KEY;
  if (!key) throw new ContentUnavailableError('AIRTABLE_KEY not set');

  const res = await fetch(`${AIRTABLE_V0}/${CONTENT_BASE}/${table}/${recId}`, {
    headers: { Authorization: `Bearer ${key}` },
    // 15 minutes, matching luna-brain.ts and for the same reason: an editorial
    // fix should surface in minutes, not a day. Keying on the record means the
    // per-record tag can drive a revalidateTag() webhook later.
    next: { revalidate: 900, tags: ['destination-content', recId] },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  // 404 is a real answer (the row was deleted or unpublished), not an outage —
  // it must not count towards the breaker or serve a stale copy for 24h.
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ContentUnavailableError(
      `Destination Content ${table}/${recId} (${res.status}): ${body.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as AirtableRecord;
  return data && typeof data.id === 'string' ? data : null;
}

interface ReadResult {
  record: AirtableRecord | null;
  stale: boolean;
}

/** One record, memoised, single-flight, stale-while-error. Throws only when
 *  there is nothing at all to serve. */
async function readRecord(table: string, recId: string): Promise<ReadResult> {
  if (!REC_ID.test(recId)) throw new ContentUnavailableError('bad record id');

  const key = `${table}/${recId}`;
  const cached = memo.get(key);
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return { record: cached.value, stale: false };

  const servableStale = cached && now - cached.at < STALE_HORIZON_MS ? cached : null;

  // A degraded Airtable must not add 4s to every traveller's page load. While
  // the breaker is open we answer from cache or not at all.
  if (breakerOpen()) {
    if (servableStale) return { record: servableStale.value, stale: true };
    throw new ContentUnavailableError('breaker open');
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchRecord(table, recId)
      .then((rec) => {
        noteSuccess();
        remember(key, rec);
        return rec;
      })
      .catch((err) => {
        noteFailure();
        throw err;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pending);
  }

  try {
    return { record: await pending, stale: false };
  } catch (err) {
    if (servableStale) return { record: servableStale.value, stale: true };
    throw err;
  }
}

// ───────── Cell coercion ─────────

/** Coerce any Airtable cell value to a trimmed display string. */
function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const name = (v as { name?: unknown }).name;
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

/** A multipleRecordLinks cell, which str() would happily render as
 *  "recaNUk5XpMUeRdHY". Candidate field names collide across the three tables
 *  ("Country" is a City's link and a Country's primary field), so every text
 *  read steps over a link cell rather than relying on candidate order. */
function isLinkCell(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((item) => typeof item === 'string' && REC_ID.test(item))
  );
}

/** First non-empty value across a list of candidate field names. */
function pick(fields: Record<string, unknown>, names: string[]): string {
  for (const n of names) {
    const v = fields[n];
    if (isLinkCell(v)) continue;
    const s = str(v);
    if (s) return s;
  }
  return '';
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

function pickList(fields: Record<string, unknown>, names: string[]): string[] {
  for (const n of names) {
    const v = fields[n];
    if (isLinkCell(v)) continue;
    const list = strList(v);
    if (list.length) return list;
  }
  return [];
}

/**
 * Airtable's REST v0 returns a multipleRecordLinks cell as an ARRAY OF RECORD ID
 * STRINGS, not {id,name} objects — pointing str() at one renders
 * "recaNUk5XpMUeRdHY" as the parent region.
 */
function linkIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && REC_ID.test(item)) out.push(item);
    else if (item && typeof item === 'object') {
      const id = (item as { id?: unknown }).id;
      if (typeof id === 'string' && REC_ID.test(id)) out.push(id);
    }
  }
  return out;
}

function num(fields: Record<string, unknown>, names: string[]): number | undefined {
  for (const n of names) {
    const v = fields[n];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const parsed = Number(v.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function bool(fields: Record<string, unknown>, names: string[]): boolean | undefined {
  for (const n of names) {
    const v = fields[n];
    if (typeof v === 'boolean') return v;
  }
  return undefined;
}

/** try/catch'd JSON array read. Returns [] on any failure, with one warning
 *  carrying the record id and field name so a bad cell is findable. */
function jsonArray<T = unknown>(raw: string, recId: string, field: string): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    console.warn(`destination-content: ${field} on ${recId} is not a JSON array`);
    return [];
  } catch {
    console.warn(`destination-content: ${field} on ${recId} did not parse as JSON`);
    return [];
  }
}

const ICONS: ReadonlySet<string> = new Set<HighlightIcon>([
  'mountain', 'sunset', 'wine', 'water', 'palm', 'city', 'temple',
  'beach', 'food', 'star', 'camera', 'heart', 'building', 'map',
  'compass', 'sun', 'snowflake',
]);

function icon(v: unknown): HighlightIcon | null {
  const s = str(v).toLowerCase();
  return ICONS.has(s) ? (s as HighlightIcon) : null;
}

// ───────── Field maps ─────────
//
// EVERY name below is the exact, case-sensitive spelling read from the live
// base schema (appuZdlMJ7HKUt6qS), not a guess. That distinction cost us real
// content: `fields[name]` is a plain object lookup, so a name that is off by a
// letter returns undefined and the block silently hides itself — "Voltage and
// Plug" (lowercase "and") blanked the Power row on every destination, and
// "Climate Temp C" blanked month-by-month temperature and rainfall everywhere,
// for months, with no error anywhere. The generator was right because it reads
// by field ID; the adapter was wrong because it guessed.
//
// Field names still differ legitimately BETWEEN the three place tables (a Resort
// has "Character and Vibe" where a City has "What Makes It Special"), and a few
// keys exist at one tier only — that is why this is still a candidate list per
// key. It is not a place to add speculative spellings: if a rename is needed,
// confirm it against the schema first.

const SECTION_FIELDS: Array<{ key: PlaceSectionKey; names: string[] }> = [
  { key: 'hero-intro', names: ['Hero Intro'] },
  { key: 'overview', names: ['Overview'] },
  { key: 'what-makes-it-special', names: ['What Makes It Special'] },
  { key: 'character', names: ['Character and Vibe'] },
  { key: 'things-to-do', names: ['Top Things to Do'] },
  { key: 'food', names: ['Food and Drink'] },
  { key: 'beaches', names: ['Beaches'] },
  { key: 'getting-there', names: ['Getting There'] },
  { key: 'getting-around', names: ['Getting Around'] },
  { key: 'nearby-excursions', names: ['Nearby Excursions'] },
  { key: 'best-time', names: ['Best Time to Visit'] },
  { key: 'practical', names: ['Practical Info'] },
  { key: 'visa', names: ['Visa Advisory'] },
  { key: 'health', names: ['Health Notes UK'] },
];

const FACT_FIELDS = {
  currency: ['Currency'],
  language: ['Language'],
  timeZone: ['Time Zone'],
  // Capital A on "And" — the live spelling. Lowercase "and" blanked this row.
  voltageAndPlug: ['Voltage And Plug'],
  // Capital F on "From", likewise.
  flightTimeFromUK: ['Flight Time From UK'],
} as const;

const STATUS_FIELDS = ['Status'];
const NAME_FIELDS = ['Resort/Area', 'City/Region', 'Country', 'Name'];

// ───────── Tier reads ─────────

interface TierData {
  tier: PlaceTier;
  from: string;
  record: AirtableRecord;
  index: IndexPlace | null;
}

function sections(t: TierData): PlaceSection[] {
  const out: PlaceSection[] = [];
  for (const { key, names } of SECTION_FIELDS) {
    const body = pick(t.record.fields, names);
    if (body) out.push({ key, tier: t.tier, from: t.from, body });
  }
  return out;
}

function highlights(t: TierData): Highlight[] {
  const raw = pick(t.record.fields, ['Highlights JSON']);
  const items = jsonArray<Record<string, unknown>>(raw, t.record.id, 'Highlights JSON');
  const out: Highlight[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const title = str(item.title ?? item.name);
    const description = str(item.description ?? item.body);
    if (!title) continue;
    out.push({ icon: icon(item.icon), title, description, tier: t.tier, from: t.from });
  }
  return out;
}

function events(t: TierData): PlaceEvent[] {
  const raw = pick(t.record.fields, ['Events JSON']);
  const items = jsonArray<Record<string, unknown>>(raw, t.record.id, 'Events JSON');
  const out: PlaceEvent[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const name = str(item.name ?? item.title);
    if (!name) continue;
    const monthLabel = str(item.month ?? item.months ?? item.when ?? item.monthLabel);
    out.push({
      name,
      description: str(item.description ?? item.body),
      monthLabel,
      months: parseMonthToken(monthLabel),
      tier: t.tier,
      from: t.from,
    });
  }
  return out;
}

/** "Climate Temps" and "Climate Rainfall" — the live names. The adapter used to
 *  read "Climate Temp C" / "Climate Rainfall mm", which match nothing, so the
 *  weather strip rendered twelve bare season chips and no numbers at all for
 *  every destination in the app while both cells were fully populated. */
function climate(t: TierData): ClimateBand | undefined {
  const tempC = parseClimateRow(pick(t.record.fields, ['Climate Temps']));
  const rainfallMm = parseClimateRow(pick(t.record.fields, ['Climate Rainfall']));
  const season = parseClimateSeasons(pick(t.record.fields, ['Climate Season']));
  if (!tempC && !rainfallMm && !season) return undefined;
  return { tier: t.tier, from: t.from, tempC, rainfallMm, season };
}

/** Split a multilineText cell into trimmed, non-empty lines. */
function lines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Place photography.
 *
 * There is NO attachment field on any of the three place tables. The real field
 * is "Image URLs": a multilineText cell holding three editor-typed URLs, one per
 * line, paired BY INDEX with one credit line per URL in "Image Attribution"
 * (the field descriptions state the two orders match). The old code looked for
 * attachment arrays called Images/Photos/Image, found nothing anywhere, and
 * returned [] — so the hero's place-photo layer and every credit line under it
 * were dead code.
 *
 * Reading typed text also removes the expiring-URL problem outright: an Airtable
 * attachment cell returns a SIGNED url that dies after roughly two hours, while
 * this payload is served for up to 900s from the memo, 24h from the memo's stale
 * horizon and 24h from the CDN's stale-while-revalidate. An attachment URL taken
 * from any of those caches would paint nothing while PlaceCredit still printed
 * the photographer's name — a credit for a photograph nobody can see. A typed
 * https URL is stable, so a cached payload stays as good as a fresh one.
 *
 * Only https is kept: an http image would be blocked as mixed content in the
 * PWA, i.e. the same invisible-photo-with-visible-credit failure.
 */
function images(t: TierData): PlaceImage[] {
  const urls = lines(pick(t.record.fields, ['Image URLs']));
  const credits = lines(pick(t.record.fields, ['Image Attribution']));
  const out: PlaceImage[] = [];
  urls.forEach((url, i) => {
    if (!/^https:\/\//i.test(url)) return;
    out.push({ url, attribution: credits[i] || undefined, tier: t.tier, from: t.from });
  });
  return out;
}

/** Countries spell these "Latitude"/"Longitude"; Cities and Resorts spell them
 *  "Lat"/"Lng". Both are live names, hence both candidates. */
function coordsOf(t: TierData): { lat: number; lng: number } | undefined {
  const lat = num(t.record.fields, ['Latitude', 'Lat']);
  const lng = num(t.record.fields, ['Longitude', 'Lng']);
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  if (t.index && typeof t.index.lat === 'number' && typeof t.index.lng === 'number') {
    return { lat: t.index.lat, lng: t.index.lng };
  }
  return undefined;
}

/** Every Best-Paired-With link on the record. Airtable exposes the inverse of a
 *  link as its own field, and Orlando returns the same three records on both
 *  sides, so both are read and deduped. */
function pairedIds(record: AirtableRecord): string[] {
  const out: string[] = [];
  for (const [field, value] of Object.entries(record.fields)) {
    if (!/paired/i.test(field)) continue;
    for (const id of linkIds(value)) if (!out.includes(id)) out.push(id);
  }
  return out.filter((id) => id !== record.id);
}

// ───────── Park mapping ─────────

function toParkRecord(record: AirtableRecord, slug: string, code: string): ParkRecord {
  const f = record.fields;
  const onSiteHotels = pick(f, ['On-Site Hotels']) || undefined;
  return {
    id: record.id,
    slug,
    code,
    name: pick(f, ['Name']),
    tagline: pick(f, ['Tagline']) || undefined,
    attractionType: pick(f, ['Attraction Type']) || undefined,
    operator: pick(f, ['Operator']) || undefined,
    locationText: pick(f, ['Location']) || undefined,
    overview: pick(f, ['Overview']) || undefined,
    bestFor: pickList(f, ['Best For']),
    daysNeeded: pick(f, ['Days Needed']) || undefined,
    bestTimeToVisit: pick(f, ['Best Time to Visit']) || undefined,
    season: pick(f, ['Season']) || undefined,
    ticketsAndPrices: pick(f, ['Tickets and Prices']) || undefined,
    priceBand: pick(f, ['Price Band']) || undefined,
    starAttractions: pick(f, ['Star Attractions']) || undefined,
    familyGuide: pick(f, ['Family Guide']) || undefined,
    thrillGuide: pick(f, ['Thrill Guide']) || undefined,
    heightRestrictions: pick(f, ['Height Restrictions']) || undefined,
    fastTrackOptions: pick(f, ['Fast Track Options']) || undefined,
    foodAndDrink: pick(f, ['Food and Drink']) || undefined,
    accessibility: pick(f, ['Accessibility']) || undefined,
    gettingThere: pick(f, ['Getting There']) || undefined,
    nearestAirport: pick(f, ['Nearest Airport']) || undefined,
    // The live Theme Parks schema carries no "Nearest Town/City" field — the
    // generator's offline join reads it from Location instead. Kept as a read
    // because an absent field simply hides the row, and the name is the one the
    // join notes use if it is ever added.
    nearestTown: pick(f, ['Nearest Town/City']) || undefined,
    onSiteHotels,
    // "Has On-Site Hotels" is the ONLY spelling of the checkbox; "On-Site
    // Hotels?" does not exist, and trying it made a park that DOES have hotels
    // print "No".
    hasOnSiteHotels: bool(f, ['Has On-Site Hotels']) ?? !!onSiteHotels,
    nearbyHotels: pick(f, ['Nearby Hotels']) || undefined,
    quirksAndInsiderTips: pick(f, ['Quirks and Insider Tips']) || undefined,
    combineWith: pick(f, ['Combine With']) || undefined,
    officialWebsite: pick(f, ['Official Website']) || undefined,
    lat: num(f, ['Latitude']),
    lng: num(f, ['Longitude']),
    verifiedDate: pick(f, ['Verified Date']) || undefined,
  };
}

// ───────── Composition ─────────

/**
 * Drain a batch of reads through a small concurrency pool, keeping whatever
 * landed before the deadline. Slots that failed or never ran stay undefined —
 * the same degrade-to-what-answered contract the old eager fan-out had.
 *
 * WHY A POOL AND NOT `.map()` + Promise.all: Airtable's documented limit is 5
 * requests per second PER BASE, and going over it returns 429 and then refuses
 * that base for 30 seconds — and the Luna Chat widget shares this account's
 * quota. Building the jobs with `.map()` starts every promise in the same tick,
 * so one cold Orlando request fired 3 tier reads plus every joined park at once:
 * 9–11 simultaneous GETs, i.e. the flagship destination 429ing itself on first
 * load, with the 429s counting towards the breaker and locking the whole
 * Destination Content base out of every route for 60s.
 *
 * `tasks` are THUNKS, not promises, precisely so nothing starts until a worker
 * picks it up.
 *
 * A concurrency cap is not the same thing as a rate limit — two in flight against
 * a fast upstream can still issue more than five reads in a second. What keeps
 * the sustained rate down is that most of these reads never reach Airtable at
 * all: the in-process memo (900s) and the per-record Next fetch cache (900s)
 * absorb them, and every read is a record-id GET that thousands of bookings
 * share. If 429s are ever observed again, a paced global gate in fetchRecord —
 * not a smaller pool here — is the next move.
 */
async function drainWithin<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  deadline: number,
): Promise<Array<T | undefined>> {
  const slots: Array<T | undefined> = new Array(tasks.length).fill(undefined);
  if (!tasks.length) return slots;

  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      // Checked before every pick so a budget that has already run out costs
      // nothing rather than issuing one more doomed request.
      if (Date.now() >= deadline) return;
      const i = next;
      next += 1;
      if (i >= tasks.length) return;
      try {
        slots[i] = await tasks[i]();
      } catch {
        // A read that failed leaves its slot undefined. Never throws upward:
        // a partial upstream failure must degrade, not blank the page.
      }
    }
  };

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(Math.max(1, concurrency), tasks.length); i += 1) {
    workers.push(worker());
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
  });
  try {
    // The deadline must also win against a read already in flight: single-flight
    // means we can be awaiting a promise started by an earlier request, whose
    // own 4s timeout can expire later than our budget.
    await Promise.race([Promise.all(workers), budget]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return slots;
}

interface TierRead {
  tier: PlaceTier;
  ref: PlaceRef;
  data: TierData | null;
  stale: boolean;
  failed: boolean;
}

async function readTier(ref: PlaceRef, index: IndexPlace | null): Promise<TierRead> {
  try {
    const { record, stale } = await readRecord(TABLE_FOR_TIER[ref.tier], ref.id);
    if (!record) return { tier: ref.tier, ref, data: null, stale, failed: false };
    // Status is re-checked here, not trusted from the snapshot: an editor who
    // pulls a page back to Draft must lose the traveller-facing page within the
    // cache TTL, not at the next regeneration.
    if (!PLACE_LIVE_STATUSES.has(pick(record.fields, STATUS_FIELDS))) {
      return { tier: ref.tier, ref, data: null, stale, failed: false };
    }
    const from = pick(record.fields, NAME_FIELDS) || index?.name || ref.slug;
    return { tier: ref.tier, ref, data: { tier: ref.tier, from, record, index }, stale, failed: false };
  } catch {
    return { tier: ref.tier, ref, data: null, stale: false, failed: true };
  }
}

function fact(tiers: TierData[], names: readonly string[]): PlaceFact | undefined {
  for (const t of tiers) {
    const value = pick(t.record.fields, names as string[]);
    if (value) return { value, tier: t.tier, from: t.from };
  }
  return undefined;
}

function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function suggestionFrom(
  place: IndexPlace,
  reason: 'paired' | 'similar',
  sharedTags: string[],
): PlaceSuggestion {
  return {
    id: place.id,
    tier: place.tier,
    code: place.code,
    slug: place.slug,
    name: place.name,
    ancestry: ancestryNames(place),
    heroSlug: heroSlugFor({ tier: place.tier, id: place.id, slug: place.slug, code: place.code }) ?? '',
    bestForTags: Array.isArray(place.tags) ? place.tags : [],
    reason,
    sharedTags,
  };
}

/** Fill in `tagline` on as many suggestions as the budget allows, in place.
 *  Best-effort by contract: a read that fails, 404s or does not get a slot
 *  leaves that card's tagline undefined, which is what it was before. */
async function populateSuggestionTaglines(
  suggestions: PlaceSuggestion[],
  overallDeadline: number,
): Promise<void> {
  const targets = (['paired', 'similar'] as const).flatMap((reason) =>
    suggestions.filter((s) => s.reason === reason).slice(0, MAX_TAGLINE_READS_PER_RAIL),
  );
  if (!targets.length) return;
  const deadline = Math.min(overallDeadline, Date.now() + TAGLINE_BUDGET_MS);
  const results = await drainWithin<string>(
    targets.map((s) => async () => {
      const { record } = await readRecord(TABLE_FOR_TIER[s.tier], s.id);
      return record ? pick(record.fields, ['Tagline']) : '';
    }),
    SUGGESTION_CONCURRENCY,
    deadline,
  );
  targets.forEach((s, i) => {
    const tagline = results[i];
    if (tagline) s.tagline = tagline;
  });
}

// Resolution is free but a country-tier read is not, so an unmatched place is
// remembered for the full TTL rather than re-read on every load.
const negative = new Map<string, number>();

function rememberUnknown(key: string): void {
  if (negative.size >= MEMO_CAP) {
    const oldest = negative.keys().next();
    if (!oldest.done) negative.delete(oldest.value);
  }
  negative.set(key, Date.now());
}

/**
 * The one composition entry point. Resolves the chain from the static index,
 * drains the record-id GETs through a small pool in three stages (tiers, then
 * parks, then suggestion taglines) inside ONE overall budget, re-checks Status
 * at read time, merges (facts collapse / prose stacks), resolves suggestions,
 * and returns the flattened view.
 *
 * The stages are ordered by how load-bearing they are, and each later stage only
 * runs if the earlier one produced a page: a destination with no content costs 3
 * reads, not 15, and the park burst is never issued for a page nobody will see.
 *
 * NEVER throws for a partial failure — a tier or park that fails is simply
 * absent. Returns null only when nothing at all resolved. Rejects only when
 * every read failed AND nothing was cached; the route turns that into 502.
 */
export async function getPlaceView(input: {
  countryCode: string;
  locationSlug?: string;
  signals: string[];
}): Promise<PlaceView | null> {
  if (!destinationContentConfigured()) return null;

  const ref = resolvePlaceRef({
    countryCode: input.countryCode,
    locationSlug: input.locationSlug,
    signals: input.signals,
  });
  if (!ref) return null;

  const negKey = `${ref.code}|${ref.id}`;
  const negAt = negative.get(negKey);
  if (negAt && Date.now() - negAt < TTL_MS) return null;

  const chain = ancestorRefs(ref);
  const order: PlaceRef[] = [chain.resort, chain.city, chain.country].filter(
    (r): r is PlaceRef => !!r,
  );
  if (!order.length) return null;

  // One budget for the whole composition, spent across the three stages.
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  // Stage 1 — the tier chain. This decides whether there is a page at all.
  const tierResults = await drainWithin<TierRead>(
    order.map((r) => () => readTier(r, placesByIds([r.id])[0] ?? null)),
    TIER_CONCURRENCY,
    deadline,
  );

  const attempted = tierResults.length;
  // A tier "answered" when it came back with a verdict of its own: a record, a
  // 404, or a row whose Status is no longer Live. A read that threw, timed out
  // or never got a slot has NOT answered — its slot is simply undefined.
  const answered = tierResults.filter((r) => r && !r.failed).length;
  if (attempted > 0 && answered === 0) {
    // Every tier read failed and nothing was cached — that is an outage, not an
    // empty destination, and the route must say 502 rather than "coming soon".
    throw new ContentUnavailableError('destination content unavailable');
  }

  const tiers = tierResults
    .filter((r): r is TierRead => !!r && !!r.data)
    .map((r) => r.data as TierData);

  if (!tiers.length) {
    // ONLY cache "this place has no content" when every tier genuinely answered.
    // The old test was `answered === 0` for the outage case and then cached the
    // negative regardless, so a PARTIAL outage — resort and city reads throwing
    // during a 429 storm while the country read returns a Draft row — wrote
    // "unknown place" for the full 900s TTL. The traveller then got "coming
    // soon" for a destination that has content, for 15 minutes per lambda
    // instance, and upstream recovery could not clear it.
    if (answered === attempted) rememberUnknown(negKey);
    return null;
  }

  // Stage 2 — parks joined to any tier of the chain. Cosmetic relative to the
  // guide itself, so they run after it and inside whatever budget is left.
  //
  // Asking for one MORE than the cap is how truncation stops being silent:
  // parkIdsForChain clamps to whatever limit it is given, so a full list is
  // indistinguishable from a truncated one at exactly MAX_PARKS. Over-fetching
  // the id list costs nothing (it is an in-memory scan of the generated index,
  // no network) and turns "were candidates dropped?" into a fact we can log.
  const chainParkIds = parkIdsForChain(ref, MAX_PARKS + 1);
  const truncated = chainParkIds.length > MAX_PARKS;
  const parkIds = truncated ? chainParkIds.slice(0, MAX_PARKS) : chainParkIds;
  if (truncated) {
    // A dropped candidate means a ticket for that park can never match, so this
    // must be visible rather than inferred from a missing panel. "at least"
    // because the id list itself was clamped at MAX_PARKS + 1.
    console.warn(
      `destination-content: ${ref.code}/${ref.slug} links at least ${MAX_PARKS + 1} parks; ` +
        `reading the first ${MAX_PARKS}. Tickets for the rest cannot match — raise MAX_PARKS.`,
    );
  }
  const parkResults = await drainWithin<AirtableRecord | null>(
    parkIds.map((id) => async () => (await readRecord(T_PARKS, id)).record),
    PARK_CONCURRENCY,
    deadline,
  );

  const stale = tierResults.some((r) => !!r && r.stale);
  const head = tiers[0];
  const headIndex = head.index;

  const trail = tiers.map((t) => t.from).filter(Boolean);

  const allSections: PlaceSection[] = [];
  const allHighlights: Highlight[] = [];
  const allEvents: PlaceEvent[] = [];
  const allImages: PlaceImage[] = [];
  for (const t of tiers) {
    allSections.push(...sections(t));
    allHighlights.push(...highlights(t));
    allEvents.push(...events(t));
    allImages.push(...images(t));
  }

  let band: ClimateBand | undefined;
  for (const t of tiers) {
    band = climate(t);
    if (band) break;
  }

  let coords: PlaceView['coords'];
  for (const t of tiers) {
    const c = coordsOf(t);
    if (c) {
      coords = { ...c, tier: t.tier, from: t.from };
      break;
    }
  }

  const authoredTags = pickList(head.record.fields, ['Best For Tags']);
  const bestForTags = authoredTags.length
    ? authoredTags
    : (Array.isArray(headIndex?.tags) ? (headIndex as IndexPlace).tags : []);

  const resortTier = tiers.find((t) => t.tier === 'resort');
  const cityTier = tiers.find((t) => t.tier === 'city');

  const suggestions: PlaceSuggestion[] = [];
  const pairedRows = placesByIds(pairedIds(head.record))
    .filter((p) => p.code === ref.code && p.id !== ref.id)
    .slice(0, MAX_SUGGESTIONS);
  for (const p of pairedRows) suggestions.push(suggestionFrom(p, 'paired', []));

  for (const { place, sharedTags } of similarPlaces({ ref, tags: bestForTags, limit: MAX_SUGGESTIONS })) {
    suggestions.push(suggestionFrom(place, 'similar', sharedTags));
  }

  // Stage 3 — suggestion taglines. PlaceSuggestion.tagline was declared and
  // never populated, so every live "Where next?" and "Add a few days" card
  // rendered an empty line where the hook belongs — strictly less than the
  // hardcoded cards they replaced. The tagline is NOT in the generated index
  // (it carries only resolution data), so it needs a read.
  //
  // That read is cheap in practice and bounded by design: it is a record-id GET
  // on a row a hundred other bookings also suggest, so it is nearly always a
  // memo or Next-fetch-cache hit; it is capped, pooled at 2 in flight, and given
  // a short sub-budget inside the overall one. If it does not land, the card
  // renders exactly as it does today rather than not at all.
  await populateSuggestionTaglines(suggestions, deadline);

  const parks: ParkRecord[] = [];
  parkResults.forEach((record, i) => {
    if (!record) return;
    if (!PARK_LIVE_STATUSES.has(pick(record.fields, STATUS_FIELDS))) return;
    const indexPark = Array.isArray(PARK_INDEX)
      ? PARK_INDEX.find((p) => p.id === parkIds[i])
      : undefined;
    parks.push(toParkRecord(record, indexPark?.slug ?? '', indexPark?.code ?? ref.code));
  });

  return {
    tier: head.tier,
    slug: head.index?.slug ?? ref.slug,
    code: ref.code,
    trail,
    breadcrumb: trail.join(' · '),
    name: head.from,
    heroSlug: heroSlugFor(ref) ?? '',
    region: fact(tiers, ['Region']),
    tagline: fact(tiers, ['Tagline']),
    facts: {
      currency: fact(tiers, FACT_FIELDS.currency),
      language: fact(tiers, FACT_FIELDS.language),
      timeZone: fact(tiers, FACT_FIELDS.timeZone),
      voltageAndPlug: fact(tiers, FACT_FIELDS.voltageAndPlug),
      flightTimeFromUK: fact(tiers, FACT_FIELDS.flightTimeFromUK),
    },
    sections: allSections,
    highlights: dedupeBy(allHighlights, (h) => dedupeKey(h.title)).slice(0, MAX_HIGHLIGHTS),
    events: dedupeBy(allEvents, (e) => dedupeKey(e.name)),
    climate: band,
    coords,
    images: dedupeBy(allImages, (im) => im.url),
    bestForTags,
    audienceTags: resortTier ? pickList(resortTier.record.fields, ['Who Is It Best For']) : [],
    audienceNote: cityTier ? pick(cityTier.record.fields, ['Who Is It Best For']) || undefined : undefined,
    suggestions,
    parks,
    resolved: {
      resort: tiers.some((t) => t.tier === 'resort'),
      city: tiers.some((t) => t.tier === 'city'),
      country: tiers.some((t) => t.tier === 'country'),
    },
    stale,
    generatedAt: new Date().toISOString(),
  };
}

/** One park by (code, slug) for the /park/[slug] deep route. */
export async function getPark(code: string, slug: string): Promise<ParkRecord | null> {
  if (!destinationContentConfigured()) return null;
  const cc = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (cc.length !== 2 || !slug) return null;

  const indexPark = PARK_BY_SLUG ? PARK_BY_SLUG[slug] : undefined;
  if (!indexPark || indexPark.code !== cc) return null;

  const { record } = await readRecord(T_PARKS, indexPark.id);
  if (!record) return null;
  if (!PARK_LIVE_STATUSES.has(pick(record.fields, STATUS_FIELDS))) return null;
  return toParkRecord(record, indexPark.slug, indexPark.code);
}

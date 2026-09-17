/**
 * Month-token maths for destination content. PURE and isomorphic — the same
 * functions run in the route and in the browser.
 *
 * The Events JSON in the Destination Content base carries NO year ("Oct",
 * "Nov-Dec"). Everything here is therefore year-agnostic: a token expands to
 * month indices, a trip window collapses to month indices, and the two are
 * intersected. A fabricated date is never produced, and an event that falls
 * outside the trip is moved, never deleted.
 *
 * "Outside the trip" and "we cannot read the month" are separate answers, and
 * splitEvents keeps them apart. Collapsing them filed "Easter" and "Varies"
 * under a "through the year" heading, which asserts a run length the Events
 * JSON never states.
 */

import type { ClimateBand, PlaceEvent, PlaceTier } from '@/types/destination-content';

const MONTH_PREFIX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(word: string): number | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 3) return null;
  const idx = MONTH_PREFIX[w.slice(0, 3)];
  return idx === undefined ? null : idx;
}

const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * "Year-round" and friends, which mean every month rather than no month.
 *
 * Content writers reach for this constantly — 31 resorts and 37 cities use it —
 * and until it was understood here every one of those entries was INVISIBLE.
 * An unreadable month token makes an event `undated`, and undated events are
 * deliberately never rendered (see splitEvents), so a permanently-open
 * attraction was the one thing guaranteed never to appear in "what's on".
 *
 * Twelve months is the honest reading: something that runs all year genuinely
 * is on while you are there, whenever you go.
 */
const ALL_YEAR = /^(?:year[\s-]?round|all[\s-]?year|throughout the year|any ?time)$/i;

/** One "Jun" or "Nov-Dec" run. Wraps forward through December. */
function parseMonthRange(part: string): number[] {
  if (ALL_YEAR.test(part.trim())) return [...ALL_MONTHS];

  const parts = part
    .split(/[-–—]|\bto\b|\buntil\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length || parts.length > 2) return [];

  const start = monthIndex(parts[0]);
  if (start === null) return [];
  if (parts.length === 1) return [start];

  const end = monthIndex(parts[1]);
  if (end === null) return [];

  const out: number[] = [];
  let m = start;
  // Wrap forward through December — "Dec-Feb" is a real season, not an error.
  // Hard cap so a malformed pair can never spin.
  for (let i = 0; i < 12; i += 1) {
    out.push(m);
    if (m === end) return out;
    m = (m + 1) % 12;
  }
  return out;
}

/** "Oct"→[9]; "Nov-Dec"→[10,11]; "May-Sep"→[4,5,6,7,8]; "Dec-Feb"→[11,0,1];
 *  "Oct, Nov"→[9,10]; "May/Jun"→[4,5]; "Year-round"→all twelve.
 *  Accepts long names, any case, '-' and en-dash. Walks forward wrapping through
 *  December, hard-capped at 12 iterations. [] when unparseable.
 *
 *  The comma/slash split is load-bearing, not a nicety: an Events JSON cell may
 *  hold an ARRAY of months (["Oct","Nov"]), which the adapter flattens to the
 *  string "Oct, Nov" (destination-content.ts str()). Reading only the first
 *  segment deleted November from Epcot Festival of the Holidays outright, so a
 *  November traveller was told the festival was not on. */
export function parseMonthToken(token: string): number[] {
  if (!token || typeof token !== 'string') return [];

  const segments = token.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  if (!segments.length) return [];

  const out: number[] = [];
  const seen = new Set<number>();
  for (const segment of segments) {
    const months = parseMonthRange(segment);
    // All or nothing. A token we can only half-read ("Easter (Mar/Apr)") is
    // reported as undated rather than asserting the half we recognised — the
    // verbatim monthLabel is still shown, so nothing is hidden from the reader.
    if (!months.length) return [];
    for (const m of months) {
      if (seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/**
 * A trip boundary is a CALENDAR DATE, never an instant, so it is read as one.
 *
 * `new Date(iso)` silently switches zone on the SHAPE of the string: a date-only
 * '2026-06-02' is parsed as UTC midnight, while a timestamped
 * '2026-06-01T00:00:00' with no offset is parsed as LOCAL midnight. A booking
 * whose tripStart carried a time and whose tripEnd did not therefore produced a
 * different month window depending on where it was read.
 *
 * That matters here more than almost anywhere else in the app: splitEvents and
 * climateForTrip are called from 'use client' components, so "local" is the
 * TRAVELLER'S BROWSER. With TZ=Asia/Tokyo, tripStart '2026-06-01T00:00:00' and
 * tripEnd '2026-06-02' gave [4, 5] — a traveller in Tokyo, Sydney or Dubai on a
 * trip starting the 1st was shown the PREVIOUS month's events as if they fell
 * during their stay.
 *
 * So the constructor is never handed a timestamp: take the leading YYYY-MM-DD
 * and anchor it explicitly at UTC midnight. The window then means the same thing
 * in every timezone, whatever shape the caller's date happens to be in — which
 * also heals bookings already stored with a timestamped tripStart, since those
 * cannot be rewritten at read time.
 *
 * Anything without an ISO date prefix is unparseable rather than best-guessed;
 * the callers all degrade to an empty window, which hides a section instead of
 * asserting the wrong months.
 */
function utcDate(iso?: string): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Month indices the window touches, inclusive. [] when either date is missing
 *  or unparseable. A window of >= 12 months returns all twelve. UTC throughout. */
export function tripMonths(fromIso?: string, toIso?: string): number[] {
  const from = utcDate(fromIso);
  const to = utcDate(toIso);
  if (!from || !to) return [];

  const startAbs = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const endAbs = to.getUTCFullYear() * 12 + to.getUTCMonth();
  if (endAbs < startAbs) return [];
  if (endAbs - startAbs >= 11) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const out: number[] = [];
  for (let a = startAbs; a <= endAbs; a += 1) out.push(((a % 12) + 12) % 12);
  return out;
}

export type EventWindow = 'during' | 'overlaps' | 'outside';

/** 'during'   = every month of the token is inside the trip window
 *  'overlaps' = some but not all ("May-Sep" on a June trip)
 *  'outside'  = no intersection, or the token did not parse */
export function classifyEvent(eventMonths: number[], trip: number[]): EventWindow {
  if (!Array.isArray(eventMonths) || !eventMonths.length) return 'outside';
  if (!Array.isArray(trip) || !trip.length) return 'outside';
  const set = new Set(trip);
  const hits = eventMonths.filter((m) => set.has(m)).length;
  if (!hits) return 'outside';
  return hits === eventMonths.length ? 'during' : 'overlaps';
}

const TIER_RANK: Record<PlaceTier, number> = { resort: 0, city: 1, country: 2 };

export interface EventSplit {
  /** 'during' + 'overlaps'. Goes under "While you're there". */
  inWindow: Array<PlaceEvent & { window: EventWindow }>;
  /** Months we READ, which simply do not touch the trip window. Render under a
   *  neutral heading (i18n 'whatson.otherTimes' — "Other times of year"). */
  otherTimes: PlaceEvent[];
  /** months === []: the source named no month we can read ("Easter", "Late
   *  summer", "Varies"), or named none at all. We do not know when these run,
   *  so no heading on the page can describe them — see OtherTimesEvents in
   *  place-sections.tsx, which deliberately does not render them. Kept on the
   *  return so a surface that can label them honestly has them to hand. */
  undated: PlaceEvent[];
  /** @deprecated Alias of `otherTimes`, kept so the existing call sites compile.
   *  It carries the OLD name and the OLD "<Place> through the year" heading, but
   *  it no longer carries undated events — filing "Easter" under that heading
   *  asserted a year-round run the source never states. New code should read
   *  `otherTimes` and render it under 'whatson.otherTimes'. */
  yearRound: PlaceEvent[];
}

/** Split for rendering. `inWindow` (during + overlaps) goes under "While you're
 *  there"; `otherTimes` goes under "Other times of year" and `undated` is held
 *  back — shown or held, never deleted, never implied to fall in the trip.
 *  Deduped by normalised name with the most specific tier winning; inWindow
 *  capped at `limit` (default 6).
 *  An empty/unparseable trip window yields inWindow: []. */
export function splitEvents(
  events: PlaceEvent[],
  tripStart?: string,
  tripEnd?: string,
  limit = 6,
): EventSplit {
  const list = Array.isArray(events) ? events : [];

  const byName = new Map<string, PlaceEvent>();
  for (const e of list) {
    if (!e || typeof e.name !== 'string') continue;
    const key = e.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;
    const held = byName.get(key);
    if (!held || TIER_RANK[e.tier] < TIER_RANK[held.tier]) byName.set(key, e);
  }
  const unique = Array.from(byName.values());

  const trip = tripMonths(tripStart, tripEnd);

  const inWindow: Array<PlaceEvent & { window: EventWindow }> = [];
  const otherTimes: PlaceEvent[] = [];
  const undated: PlaceEvent[] = [];
  for (const e of unique) {
    // classifyEvent answers 'outside' for BOTH a real non-overlap and an
    // unreadable month token, so the two are separated here rather than there:
    // one is "not while you are there", the other is "we do not know when".
    // Collapsing them is what put "Easter" under "<Place> through the year".
    const readable = Array.isArray(e.months) && e.months.length > 0;
    if (!readable) {
      undated.push(e);
      continue;
    }
    const window = classifyEvent(e.months, trip);
    if (window === 'outside') otherTimes.push(e);
    else inWindow.push({ ...e, window });
  }

  // A festival that runs for the whole trip is more use than one that clips its
  // last day, so 'during' is promoted before the cap bites.
  inWindow.sort((a, b) => {
    if (a.window !== b.window) return a.window === 'during' ? -1 : 1;
    return TIER_RANK[a.tier] - TIER_RANK[b.tier];
  });

  return { inWindow: inWindow.slice(0, limit), otherTimes, undated, yearRound: otherTimes };
}

/** A climate row is 12 comma-separated numbers or it is nothing. A short row is
 *  never padded and a long one is never truncated — a fabricated August
 *  temperature is worse than no strip at all. */
export function parseClimateRow(raw: string): number[] | null {
  if (!raw) return null;
  const parts = raw.split(/[,;]/).map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length !== 12) return null;
  const nums = parts.map((p) => Number(p));
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

/** The same rule for the season band, over the three-value vocabulary. */
export function parseClimateSeasons(raw: string): Array<'best' | 'shoulder' | 'off'> | null {
  if (!raw) return null;
  const parts = raw.split(/[,;]/).map((p) => p.trim().toLowerCase()).filter((p) => p !== '');
  if (parts.length !== 12) return null;
  const ok = parts.every((p) => p === 'best' || p === 'shoulder' || p === 'off');
  return ok ? (parts as Array<'best' | 'shoulder' | 'off'>) : null;
}

/** The Jan..Dec slices overlapping the trip, for the climate strip. */
export function climateForTrip(
  climate: ClimateBand | undefined,
  tripStart?: string,
  tripEnd?: string,
): Array<{
  month: number;
  tempC: number | null;
  rainfallMm: number | null;
  season: 'best' | 'shoulder' | 'off' | null;
}> {
  if (!climate) return [];
  const months = tripMonths(tripStart, tripEnd);
  if (!months.length) return [];

  return months.map((month) => ({
    month,
    tempC: climate.tempC ? (climate.tempC[month] ?? null) : null,
    rainfallMm: climate.rainfallMm ? (climate.rainfallMm[month] ?? null) : null,
    season: climate.season ? (climate.season[month] ?? null) : null,
  }));
}

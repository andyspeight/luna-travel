/**
 * Our own route database, accumulated rather than bought.
 *
 * AeroDataBox answers one question: what flew out of this airport in the last
 * seven days. On its own that is a weak source. A twice-weekly service that
 * happened not to run, or a ski charter asked about in July, is simply absent,
 * and absent looks exactly like "no such route" — which is how you rebuild the
 * bug that started this, with a data source attached to lend it authority.
 *
 * Asked every week and never thrown away, the same source becomes something
 * nobody sells: a full year of which routes run, who flies them, and in which
 * months. Around fifty calls a week for the UK, Ireland and Romania together.
 * It improves on its own and it costs roughly nothing.
 *
 * THE ONE RULE. A stored row means "we have seen this flown". Nothing stored
 * anywhere means "this route does not exist", and nothing may be added that
 * does. lookupRoute() returns `confirmed: true` with the detail, or
 * `confirmed: false` and NOTHING ELSE — no reason, no coverage flag, no
 * distinction a caller could wire up to a sentence. That is deliberate: the
 * rule is enforced by the shape of the answer, not by a comment asking people
 * to be careful. Diagnostics live in airportStatus(), which is for operators.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { airportFeeds, airportRoutes, type RouteRecord } from '@/lib/aerodatabox';

const OBSERVATIONS = 'route_observations';
const AIRPORTS = 'route_airport_status';

/**
 * Where our clients' customers depart from. Mirrors the markets Luna Chat
 * offers in lib/departure-markets.js: Great Britain, Ireland, Romania.
 *
 * Romania is here because it is the market that raised the incident, and it is
 * still missing from the offers cache's own airport list in tg-widgets.
 */
export const MARKET_ORIGINS: { iata: string; icao: string; market: string }[] = [
  // Great Britain
  { iata: 'LHR', icao: 'EGLL', market: 'GB' },
  { iata: 'LGW', icao: 'EGKK', market: 'GB' },
  { iata: 'STN', icao: 'EGSS', market: 'GB' },
  { iata: 'LTN', icao: 'EGGW', market: 'GB' },
  { iata: 'LCY', icao: 'EGLC', market: 'GB' },
  { iata: 'MAN', icao: 'EGCC', market: 'GB' },
  { iata: 'BHX', icao: 'EGBB', market: 'GB' },
  { iata: 'EDI', icao: 'EGPH', market: 'GB' },
  { iata: 'GLA', icao: 'EGPF', market: 'GB' },
  { iata: 'LBA', icao: 'EGNM', market: 'GB' },
  { iata: 'NCL', icao: 'EGNT', market: 'GB' },
  { iata: 'LPL', icao: 'EGGP', market: 'GB' },
  { iata: 'BRS', icao: 'EGGD', market: 'GB' },
  { iata: 'EMA', icao: 'EGNX', market: 'GB' },
  { iata: 'BFS', icao: 'EGAA', market: 'GB' },
  { iata: 'BHD', icao: 'EGAC', market: 'GB' },
  { iata: 'SOU', icao: 'EGHI', market: 'GB' },
  { iata: 'CWL', icao: 'EGFF', market: 'GB' },
  { iata: 'ABZ', icao: 'EGPD', market: 'GB' },
  { iata: 'EXT', icao: 'EGTE', market: 'GB' },
  { iata: 'BOH', icao: 'EGHH', market: 'GB' },
  { iata: 'NWI', icao: 'EGSH', market: 'GB' },
  { iata: 'INV', icao: 'EGPE', market: 'GB' },
  // Ireland
  { iata: 'DUB', icao: 'EIDW', market: 'IE' },
  { iata: 'ORK', icao: 'EICK', market: 'IE' },
  { iata: 'SNN', icao: 'EINN', market: 'IE' },
  { iata: 'NOC', icao: 'EIKN', market: 'IE' },
  { iata: 'KIR', icao: 'EIKY', market: 'IE' },
  // Romania
  { iata: 'OTP', icao: 'LROP', market: 'RO' },
  { iata: 'CLJ', icao: 'LRCL', market: 'RO' },
  { iata: 'TSR', icao: 'LRTR', market: 'RO' },
  { iata: 'IAS', icao: 'LRIA', market: 'RO' },
  { iata: 'SBZ', icao: 'LRSB', market: 'RO' },
  { iata: 'CRA', icao: 'LRCV', market: 'RO' },
  { iata: 'BCM', icao: 'LRBC', market: 'RO' },
  { iata: 'SCV', icao: 'LRSV', market: 'RO' },
  { iata: 'OMR', icao: 'LROD', market: 'RO' },
  { iata: 'TGM', icao: 'LRTM', market: 'RO' },
  { iata: 'CND', icao: 'LRCK', market: 'RO' },
  { iata: 'BAY', icao: 'LRBM', market: 'RO' },
  { iata: 'SUJ', icao: 'LRSM', market: 'RO' },
  { iata: 'ARW', icao: 'LRAR', market: 'RO' },
];

// ── pure helpers, kept pure so they can be checked without a database ────────

/**
 * The dedupe key for an airline.
 *
 * Deliberately the NAME, lowercased, not a code. Wizz Air Hungary and Wizz Air
 * Malta are separate operators with separate codes flying the same city pair,
 * and the very first live probe of Cluj to Malaga came back as the Malta arm.
 * Keying on a code would split one airline into several rows, or worse, miss a
 * match. Falls back to a code only when the provider sends no name at all.
 */
export function carrierKey(o: { name?: string | null; iata?: string | null; icao?: string | null }): string {
  const name = (o.name || '').trim().toLowerCase();
  if (name) return name;
  return (o.iata || o.icao || '').trim().toLowerCase();
}

/** The calendar month, 1-12, that a seven-day window ending on `date` sits in. */
export function monthOf(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : date;
  return d.getUTCMonth() + 1;
}

/**
 * Add a month to what we have already seen, keeping the list sorted and unique.
 * Never removes one: a route seen last January is still a January route in July,
 * and forgetting that is exactly the gap this whole design exists to close.
 */
export function normaliseMonths(existing: unknown): number[] {
  const out = new Set<number>();
  if (Array.isArray(existing)) {
    for (const m of existing) {
      const n = Number(m);
      if (Number.isInteger(n) && n >= 1 && n <= 12) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function mergeMonths(existing: unknown, month: number): number[] {
  const out = new Set<number>(normaliseMonths(existing));
  if (Number.isInteger(month) && month >= 1 && month <= 12) out.add(month);
  return [...out].sort((a, b) => a - b);
}

/** The earlier of two YYYY-MM-DD dates, tolerating a missing one. */
export function earliest(a: string | null | undefined, b: string): string {
  return a && a < b ? a : b;
}

/** The later of two YYYY-MM-DD dates, tolerating a missing one. */
export function latest(a: string | null | undefined, b: string): string {
  return a && a > b ? a : b;
}

/** Does this airline match what the visitor said? Name first, then codes. */
export function carrierMatches(
  row: { carrier_name?: string | null; carrier_iata?: string | null; carrier_icao?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const name = (row.carrier_name || '').toLowerCase();
  if (name && (name.includes(q) || q.includes(name))) return true;
  return [row.carrier_iata, row.carrier_icao].some((c) => !!c && c.toLowerCase() === q);
}

// ── the sweep ───────────────────────────────────────────────────────────────

export interface SweepResult {
  iata: string;
  ok: boolean;
  status: number;
  covered: boolean;
  routeCount: number;
  rowsWritten: number;
  error: string | null;
}

/**
 * One departure airport, one billed Tier 3 call, merged into what we already
 * know. `dateLocal` (YYYY-MM-DD) asks about the seven days before that date
 * instead of now, which is how the backfill works.
 */
export async function sweepOrigin(
  iata: string,
  icao: string | null,
  dateLocal?: string,
): Promise<SweepResult> {
  const db = getSupabaseAdmin();
  const seenOn = dateLocal || new Date().toISOString().slice(0, 10);
  const month = monthOf(seenOn);

  let feedsCovered = false;
  let schedulesFeed: string | null = null;
  if (icao) {
    const feeds = await airportFeeds(icao);
    if (feeds) {
      feedsCovered = feeds.covered;
      schedulesFeed = feeds.schedules;
    }
  }

  let res: Awaited<ReturnType<typeof airportRoutes>>;
  try {
    res = await airportRoutes(iata, dateLocal);
  } catch (e) {
    await writeAirportStatus(db, { iata, icao, covered: feedsCovered, schedulesFeed, status: 0, routeCount: 0, error: (e as Error).message });
    return { iata, ok: false, status: 0, covered: feedsCovered, routeCount: 0, rowsWritten: 0, error: (e as Error).message };
  }

  if (res.routes === null) {
    const error = res.status === 401 || res.status === 403 ? 'plan_does_not_include_routes' : `http_${res.status}`;
    await writeAirportStatus(db, { iata, icao, covered: feedsCovered, schedulesFeed, status: res.status, routeCount: 0, error });
    return { iata, ok: false, status: res.status, covered: feedsCovered, routeCount: 0, rowsWritten: 0, error };
  }

  const rowsWritten = await mergeRoutes(db, iata, res.routes, seenOn, month);
  await writeAirportStatus(db, {
    iata, icao, covered: feedsCovered, schedulesFeed,
    status: res.status, routeCount: res.routes.length, error: null,
  });

  return {
    iata, ok: true, status: res.status, covered: feedsCovered,
    routeCount: res.routes.length, rowsWritten, error: null,
  };
}

/**
 * Merge one airport's routes into the store.
 *
 * Read-then-write rather than a blind upsert, because months_seen has to be
 * UNIONED with what is already there and not replaced. The sweep is a single
 * weekly cron with no concurrency, so the read-modify-write is safe here; if it
 * ever runs in parallel this needs to move into SQL.
 */
async function mergeRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  origin: string,
  routes: RouteRecord[],
  seenOn: string,
  month: number,
): Promise<number> {
  type Incoming = {
    origin_iata: string; destination_iata: string;
    carrier_key: string; carrier_name: string;
    carrier_iata: string | null; carrier_icao: string | null;
    avg_daily_flights: number | null;
  };
  const incoming: Incoming[] = [];
  for (const r of routes) {
    const dest = (r.iata || '').toUpperCase();
    if (!dest) continue;
    for (const o of r.operators) {
      const key = carrierKey(o);
      if (!key) continue;
      incoming.push({
        origin_iata: origin,
        destination_iata: dest,
        carrier_key: key,
        carrier_name: o.name || key,
        carrier_iata: o.iata || null,
        carrier_icao: o.icao || null,
        avg_daily_flights: r.averageDailyFlights,
      });
    }
  }
  if (!incoming.length) return 0;

  const { data: existing } = await db
    .from(OBSERVATIONS)
    .select('origin_iata,destination_iata,carrier_key,months_seen,first_seen_on,last_seen_on,observations')
    .eq('origin_iata', origin);

  const prior = new Map<string, { months_seen: unknown; first_seen_on: string; last_seen_on: string; observations: number }>();
  for (const row of existing || []) {
    prior.set(`${row.destination_iata}|${row.carrier_key}`, row);
  }

  const payload = incoming.map((i) => {
    const was = prior.get(`${i.destination_iata}|${i.carrier_key}`);
    return {
      ...i,
      months_seen: mergeMonths(was?.months_seen, month),
      // Earliest wins and latest wins, independently. Both have to be order
      // safe because the backfill walks BACKWARDS through past weeks: it must
      // be able to drag first_seen_on earlier without ever dragging
      // last_seen_on back with it.
      first_seen_on: earliest(was?.first_seen_on, seenOn),
      last_seen_on: latest(was?.last_seen_on, seenOn),
      observations: (was?.observations || 0) + 1,
    };
  });

  const { error } = await db
    .from(OBSERVATIONS)
    .upsert(payload, { onConflict: 'origin_iata,destination_iata,carrier_key' });
  if (error) throw new Error(`route upsert failed: ${error.message}`);
  return payload.length;
}

async function writeAirportStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  o: { iata: string; icao: string | null; covered: boolean; schedulesFeed: string | null; status: number; routeCount: number; error: string | null },
): Promise<void> {
  const { data: was } = await db
    .from(AIRPORTS).select('sweeps').eq('iata', o.iata).maybeSingle();
  await db.from(AIRPORTS).upsert(
    {
      iata: o.iata,
      icao: o.icao,
      covered: o.covered,
      schedules_feed: o.schedulesFeed,
      last_status: o.status,
      route_count: o.routeCount,
      sweeps: (was?.sweeps || 0) + 1,
      last_swept_at: new Date().toISOString(),
      last_error: o.error,
    },
    { onConflict: 'iata' },
  );
}

export interface SweepSummary {
  sweptAt: string;
  dateLocal: string | null;
  airports: number;
  billedCalls: number;
  covered: number;
  rowsWritten: number;
  failures: { iata: string; error: string }[];
  results: SweepResult[];
}

/**
 * Sweep a list of origins, one after another.
 *
 * Sequential on purpose. This is a weekly background job with no deadline, and
 * a burst of parallel Tier 3 calls against a small vendor is how rate limits
 * and surprise bills happen. The offers cron learned that the hard way.
 */
export async function sweepOrigins(
  origins: { iata: string; icao: string }[],
  dateLocal?: string,
): Promise<SweepSummary> {
  const results: SweepResult[] = [];
  for (const o of origins) {
    results.push(await sweepOrigin(o.iata, o.icao, dateLocal));
  }
  return {
    sweptAt: new Date().toISOString(),
    dateLocal: dateLocal || null,
    airports: origins.length,
    billedCalls: results.length,
    covered: results.filter((r) => r.covered).length,
    rowsWritten: results.reduce((t, r) => t + r.rowsWritten, 0),
    failures: results.filter((r) => r.error).map((r) => ({ iata: r.iata, error: r.error as string })),
    results,
  };
}

// ── the lookup ──────────────────────────────────────────────────────────────

/**
 * What Luna is allowed to know about a pair.
 *
 * Note what is NOT here. There is no `found: false` with a reason beside it, no
 * coverage flag, no "we swept this airport and saw nothing". A caller holding
 * this object cannot tell the difference between a route that does not exist,
 * an airport we have never swept, and a week where nothing happened to fly —
 * because we cannot tell either, and a shape that pretends otherwise is an
 * invitation to write the sentence that caused the original complaint.
 */
export interface RouteAnswer {
  confirmed: boolean;
  operators?: { name: string; iata: string | null; icao: string | null }[];
  monthsSeen?: number[];
  seenInMonth?: boolean;
  lastSeenOn?: string;
}

export async function lookupRoute(
  from: string,
  to: string,
  opts: { carrier?: string; month?: number } = {},
): Promise<RouteAnswer> {
  const origin = from.trim().toUpperCase();
  const dest = to.trim().toUpperCase();
  if (!origin || !dest) return { confirmed: false };

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(OBSERVATIONS)
    .select('carrier_name,carrier_iata,carrier_icao,months_seen,last_seen_on')
    .eq('origin_iata', origin)
    .eq('destination_iata', dest);

  // A database error is ignorance, not an answer. Same shape as never having
  // seen it, so an outage can never turn into a denial.
  if (error || !data || !data.length) return { confirmed: false };

  const rows = opts.carrier ? data.filter((r: Record<string, unknown>) => carrierMatches(r, opts.carrier as string)) : data;
  if (!rows.length) return { confirmed: false };

  const months = new Set<number>();
  let lastSeen = '';
  for (const r of rows) {
    for (const m of normaliseMonths(r.months_seen)) months.add(m);
    if (r.last_seen_on && r.last_seen_on > lastSeen) lastSeen = r.last_seen_on;
  }
  const monthsSeen = [...months].sort((a, b) => a - b);

  return {
    confirmed: true,
    operators: rows.map((r: Record<string, unknown>) => ({
      name: String(r.carrier_name || ''),
      iata: (r.carrier_iata as string) || null,
      icao: (r.carrier_icao as string) || null,
    })),
    monthsSeen,
    seenInMonth: opts.month ? monthsSeen.includes(opts.month) : undefined,
    lastSeenOn: lastSeen || undefined,
  };
}

/** Operator-facing diagnostics. Deliberately separate from lookupRoute. */
export async function airportStatus(iata?: string) {
  const db = getSupabaseAdmin();
  let q = db.from(AIRPORTS).select('*').order('iata');
  if (iata) q = q.eq('iata', iata.trim().toUpperCase());
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message, airports: [] };
  return { ok: true, error: null, airports: data || [] };
}

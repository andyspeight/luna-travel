/**
 * Shared AeroDataBox client.
 *
 * Single source of truth for talking to AeroDataBox (API.Market). Used by the
 * subscribe route, the flight-test rig, and any future flight work. Keeps the
 * key server-side and the base URL / header / status-mapping in one place.
 */

import type { FlightStatusCode } from '@/types/booking';

const ADA_BASE = 'https://prod.api.market/api/v1/aedbx/aerodatabox';
const ADA_KEY = process.env.AERODATABOX_API_KEY || '';

function headers() {
  return { 'x-api-market-key': ADA_KEY, Accept: 'application/json' };
}

/**
 * fetch with a hard timeout. Used by the health probes so a slow/hanging
 * AeroDataBox can never stall the admin Settings route (which runs several of
 * these) into a 25s function timeout. Aborting rejects, which every probe
 * caller already treats as "not reachable".
 */
async function adaFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export function adaConfigured(): boolean {
  return !!ADA_KEY;
}

/** AeroDataBox FlightStatus -> our FlightStatusCode. */
export function mapStatus(s?: string): FlightStatusCode {
  switch (s) {
    case 'CheckIn': return 'CheckIn';
    case 'Boarding': return 'Boarding';
    case 'GateClosed': return 'GateClosed';
    case 'EnRoute':
    case 'Departed': return 'Departed';
    case 'Delayed': return 'Delayed';
    case 'Approaching': return 'Approaching';
    case 'Arrived': return 'Landed';
    case 'Canceled': return 'Cancelled';
    case 'Diverted': return 'Diverted';
    case 'CanceledUncertain': return 'CancelledUncertain';
    case 'Expected': return 'Scheduled';
    default: return 'Unknown';
  }
}

/**
 * Look up a flight's status on its departure date. Returns the raw AeroDataBox
 * flight object (first match), or null on 204 / no match. Throws on a real
 * HTTP error so callers can decide how to handle it.
 *
 * withLocation=true asks for live position (lat/lon/altitude/speed) when the
 * flight is airborne. It's a query flag, no extra cost beyond the request.
 */
export async function fetchFlight(
  carrier: string,
  number: string,
  dateLocal: string,
  opts: { withLocation?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const flightNo = `${carrier}${number}`;
  const q = opts.withLocation ? '&withLocation=true' : '';
  const url = `${ADA_BASE}/flights/number/${encodeURIComponent(flightNo)}/${dateLocal}?dateLocalRole=Departure${q}`;
  const res = await fetch(url, { headers: headers() });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`ADA flight lookup ${res.status}`);
  const arr = await res.json();
  return Array.isArray(arr) && arr.length ? (arr[0] as Record<string, unknown>) : null;
}

/** Free-tier coverage check: does this airport have live flight updates? Needs ICAO. */
export async function hasLiveFeed(icao?: string): Promise<boolean> {
  if (!icao) return false;
  try {
    const res = await fetch(
      `${ADA_BASE}/health/services/airports/${encodeURIComponent(icao)}/feeds`,
      { headers: headers() },
    );
    if (!res.ok) return false;
    const data = await res.json();
    const status = data?.liveFlightUpdatesFeed?.status;
    return status === 'OK' || status === 'OKPartial';
  } catch {
    return false;
  }
}

/** Register a credit-based web-hook subscription for a flight number. */
export async function createSubscription(
  carrier: string,
  number: string,
  webhookBase: string,
  webhookToken: string,
): Promise<string | null> {
  if (!webhookBase || !webhookToken) return null;
  const subjectId = `${carrier}${number}`;
  const url = `${ADA_BASE}/subscriptions/webhook/FlightByNumber/${encodeURIComponent(subjectId)}`;
  const callback = `${webhookBase}/api/flights/webhook?t=${encodeURIComponent(webhookToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: callback, maxDeliveryRetries: 1 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || data?.subscription?.id || null;
}

/** Get the current flight-alert credit balance. */
export async function getBalance(): Promise<{ creditsRemaining: number } | null> {
  try {
    const res = await fetch(`${ADA_BASE}/subscriptions/balance`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return { creditsRemaining: Number(data?.creditsRemaining ?? 0) };
  } catch {
    return null;
  }
}

async function probeStatus(path: string): Promise<number | null> {
  try {
    const res = await adaFetch(`${ADA_BASE}${path}`, { headers: headers() }, 3500);
    return res.status;
  } catch {
    return null; // network error / DNS / timeout
  }
}

/**
 * Health probe for the flight-alert pipeline. Answers "is AeroDataBox reachable
 * right now, and how many alert credits remain?" robustly — it does NOT hinge
 * the whole verdict on one endpoint. Reachability is true if ANY of the credit
 * balance, the airport-feed health endpoint, or a real flight lookup responds
 * 2xx (so the key is valid and the API is up). Credits are read from the
 * balance endpoint when available; `null` means "couldn't read the balance"
 * (which is NOT the same as the API being down — lookups can still work).
 *
 * `status` is the HTTP status from the first call, for diagnostics (401/403 →
 * key invalid/plan; 5xx/null → service/network).
 */
export async function probeAeroDataBox(): Promise<{
  reachable: boolean;
  status: number | null;
  credits: number | null;
  balanceOk: boolean; // the /subscriptions/balance endpoint returned 2xx
  rawBalance: unknown; // its body, for diagnostics (owner-only)
}> {
  if (!ADA_KEY) return { reachable: false, status: null, credits: null, balanceOk: false, rawBalance: null };

  // 1) Balance — reachability + credits in one call. A 2xx here means the
  //    subscription system is accessible (even if we can't name the credit
  //    field), so the pipeline is healthy.
  let status: number | null = null;
  try {
    const res = await adaFetch(`${ADA_BASE}/subscriptions/balance`, { headers: headers() }, 3500);
    status = res.status;
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return { reachable: true, status, credits: extractCredits(data), balanceOk: true, rawBalance: data };
    }
  } catch {
    status = null;
  }

  // 2) Balance unavailable — confirm the API is up another way (credits unknown).
  const health = await probeStatus('/health/services/airports/EGLL/feeds');
  if (health && health >= 200 && health < 300) {
    return { reachable: true, status: status ?? health, credits: null, balanceOk: false, rawBalance: null };
  }

  // 3) Last resort — a real flight lookup (the call the pipeline actually makes).
  //    A valid key returns 2xx/204 even with no matching flight; an invalid key 4xx.
  const today = new Date().toISOString().slice(0, 10);
  const flight = await probeStatus(`/flights/number/BA100/${today}?dateLocalRole=Departure`);
  if (flight && ((flight >= 200 && flight < 300) || flight === 204)) {
    return { reachable: true, status: status ?? flight, credits: null, balanceOk: false, rawBalance: null };
  }

  return { reachable: false, status: status ?? health ?? flight, credits: null, balanceOk: false, rawBalance: null };
}

/** Pull a credit/units-like number out of the balance response, whatever it's named. */
function extractCredits(data: unknown, depth = 0): number | null {
  if (typeof data === 'number') return Number.isFinite(data) ? data : null;
  if (data && typeof data === 'object' && depth < 3) {
    const obj = data as Record<string, unknown>;
    for (const k of ['creditsRemaining', 'subscriptionsBalance', 'balance', 'remaining', 'credits', 'amount', 'value']) {
      if (typeof obj[k] === 'number') return obj[k] as number;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && /credit|balance|remain|unit/i.test(k)) return v;
      if (v && typeof v === 'object') {
        const nested = extractCredits(v, depth + 1);
        if (nested != null) return nested;
      }
    }
  }
  return null;
}

// --- helpers ----------------------------------------------------------------

function airportField(mv: Record<string, unknown> | undefined, key: string): string | undefined {
  const ap = mv?.airport as Record<string, unknown> | undefined;
  const v = ap?.[key];
  return typeof v === 'string' && v.length ? v : undefined;
}

function movementTime(mv: Record<string, unknown> | undefined): { scheduled?: string; revised?: string } {
  const sched = (mv?.scheduledTime as Record<string, unknown> | undefined)?.utc as string | undefined;
  const revised = (mv?.revisedTime as Record<string, unknown> | undefined)?.utc as string | undefined;
  return {
    scheduled: typeof sched === 'string' ? sched : undefined,
    revised: typeof revised === 'string' ? revised : undefined,
  };
}

/**
 * Normalise a raw AeroDataBox flight object into the fields the UI cares about.
 * Pure mapping, no fetch — safe to reuse anywhere.
 *
 * Times: BOTH scheduled and revised are exposed separately. `est*Time` is
 * revised-or-scheduled; `sched*Time` is the scheduled baseline so the UI can
 * strike-through only when revised genuinely differs. IATA for display; ICAO
 * kept for the coverage call. Aircraft + live position included when present.
 */
export interface NormalisedFlight {
  statusCode: FlightStatusCode;

  airlineName?: string;

  depAirportIata?: string;
  depAirportIcao?: string;
  depAirportName?: string;
  arrAirportIata?: string;
  arrAirportIcao?: string;
  arrAirportName?: string;

  depTerminal?: string;
  depGate?: string;
  arrTerminal?: string;
  baggageBelt?: string;
  checkInDesk?: string;

  schedDepTime?: string;
  estDepTime?: string;   // revised || scheduled
  schedArrTime?: string;
  estArrTime?: string;   // revised || scheduled

  aircraftModel?: string;
  aircraftReg?: string;

  // Live position (only when airborne + withLocation requested)
  liveLat?: number;
  liveLon?: number;
  liveAltitudeFt?: number;
  liveSpeedKt?: number;
  liveReportedAt?: string;
}

export function normaliseFlight(f: Record<string, unknown> | null): NormalisedFlight | null {
  if (!f) return null;
  const dep = (f.departure || undefined) as Record<string, unknown> | undefined;
  const arr = (f.arrival || undefined) as Record<string, unknown> | undefined;
  const aircraft = (f.aircraft || undefined) as Record<string, unknown> | undefined;
  const airline = (f.airline || undefined) as Record<string, unknown> | undefined;
  const loc = (f.location || undefined) as Record<string, unknown> | undefined;

  const depT = movementTime(dep);
  const arrT = movementTime(arr);

  const altFt = ((loc?.altitude as Record<string, unknown> | undefined)?.feet as number) ?? undefined;
  const spdKt = ((loc?.groundSpeed as Record<string, unknown> | undefined)?.kt as number) ?? undefined;

  return {
    statusCode: mapStatus(f.status as string),

    airlineName: (airline?.name as string) ?? undefined,

    depAirportIata: airportField(dep, 'iata'),
    depAirportIcao: airportField(dep, 'icao'),
    depAirportName:
      airportField(dep, 'name') || airportField(dep, 'shortName') || airportField(dep, 'municipalityName'),
    arrAirportIata: airportField(arr, 'iata'),
    arrAirportIcao: airportField(arr, 'icao'),
    arrAirportName:
      airportField(arr, 'name') || airportField(arr, 'shortName') || airportField(arr, 'municipalityName'),

    depTerminal: (dep?.terminal as string) ?? undefined,
    depGate: (dep?.gate as string) ?? undefined,
    arrTerminal: (arr?.terminal as string) ?? undefined,
    baggageBelt: (arr?.baggageBelt as string) ?? undefined,
    checkInDesk: (dep?.checkInDesk as string) ?? undefined,

    schedDepTime: depT.scheduled,
    estDepTime: depT.revised || depT.scheduled,
    schedArrTime: arrT.scheduled,
    estArrTime: arrT.revised || arrT.scheduled,

    aircraftModel: (aircraft?.model as string) ?? undefined,
    aircraftReg: (aircraft?.reg as string) ?? undefined,

    liveLat: typeof loc?.lat === 'number' ? (loc.lat as number) : undefined,
    liveLon: typeof loc?.lon === 'number' ? (loc.lon as number) : undefined,
    liveAltitudeFt: typeof altFt === 'number' ? altFt : undefined,
    liveSpeedKt: typeof spdKt === 'number' ? spdKt : undefined,
    liveReportedAt: (loc?.reportedAtUtc as string) ?? undefined,
  };
}

export { ADA_BASE };

// ─── Route lookup ────────────────────────────────────────────────────────────
//
// Everything above answers "what is happening to a flight someone has already
// booked". This answers a different question, asked BEFORE booking: does anyone
// fly A to B non-stop, and who.
//
// It exists because Luna Chat told a Romanian customer that Wizz Air probably
// flew Cluj to Malaga "with a short connection (not direct)". Wizz fly it
// direct. Luna has no schedule data, so it guessed, and the prompt has since
// been changed to stop it guessing. The open question is whether we can give it
// a real answer instead, and we already hold an AeroDataBox key, so the cheapest
// way to find out is to ask.
//
// TWO RULES, both learned the hard way.
//
// 1. POSITIVE DIRECTION ONLY. The routes endpoint reports the seven days before
//    now. A route that is seasonal, paused, or simply did not operate this week
//    is absent, and absent does NOT mean "no such route". Anything built on this
//    may say "yes, that is flown non-stop" and must NEVER say "there is no
//    direct flight" — that is the original bug with a data source bolted on to
//    lend it false authority.
//
// 2. NEVER MATCH AN AIRLINE ON ONE CODE. Wizz fly Cluj to Malaga under two
//    separate AOCs, Wizz Air Hungary (W6/WZZ) and Wizz Air Malta (W4/WMT), and
//    which one operates varies. A matcher keyed on "W6" answers "not found" for
//    a route that is flying. Same trap for Ryanair/Buzz/Malta Air, easyJet and
//    easyJet Europe, BA and BA Euroflyer. Match the name as well as the codes.

export interface AirportFeeds {
  schedules: string | null;
  live: string | null;
  adsb: string | null;
  covered: boolean; // schedules feed is OK or OKPartial — routes data is worth asking for
}

/**
 * Free-tier coverage check, and the first thing to run. If an airport has no
 * schedules feed, the routes endpoint returns nothing for it and no amount of
 * paying fixes that. ICAO only (Cluj is LRCL).
 */
export async function airportFeeds(icao: string): Promise<AirportFeeds | null> {
  try {
    const res = await adaFetch(
      `${ADA_BASE}/health/services/airports/${encodeURIComponent(icao)}/feeds`,
      { headers: headers() },
      6000,
    );
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, Record<string, string> | undefined>;
    const pick = (k: string) => d?.[k]?.status ?? null;
    const schedules = pick('flightSchedulesFeed');
    return {
      schedules,
      live: pick('liveFlightUpdatesFeed'),
      adsb: pick('adsbUpdatesFeed'),
      covered: schedules === 'OK' || schedules === 'OKPartial',
    };
  } catch {
    return null;
  }
}

export interface RouteRecord {
  iata: string | null;
  icao: string | null;
  name: string | null;
  municipality: string | null;
  countryCode: string | null;
  averageDailyFlights: number | null;
  operators: { name: string | null; iata: string | null; icao: string | null }[];
}

/**
 * Every destination flown non-stop from `iata` in the last seven days, each with
 * the airlines operating it. This is a TIER 3 call and costs more than one API
 * unit, so it is never on a visitor path — admin and cron only.
 *
 * Returns null when the plan does not include the endpoint (403) or the airport
 * is not covered (204 / empty), which are different failures and the caller
 * should say which.
 */
export async function airportRoutes(
  iata: string,
): Promise<{ routes: RouteRecord[] | null; status: number; raw: unknown }> {
  const res = await adaFetch(
    `${ADA_BASE}/airports/iata/${encodeURIComponent(iata)}/stats/routes/daily`,
    { headers: headers() },
    15000,
  );
  if (res.status === 204) return { routes: [], status: 204, raw: null };
  if (!res.ok) return { routes: null, status: res.status, raw: await res.text().catch(() => null) };

  const d = (await res.json().catch(() => null)) as { routes?: unknown[] } | null;
  const rows = Array.isArray(d?.routes) ? d!.routes! : [];
  const routes: RouteRecord[] = rows.map((r) => {
    const row = r as Record<string, unknown>;
    const dest = (row.destination ?? {}) as Record<string, unknown>;
    const ops = Array.isArray(row.operators) ? (row.operators as Record<string, unknown>[]) : [];
    return {
      iata: (dest.iata as string) ?? null,
      icao: (dest.icao as string) ?? null,
      name: (dest.name as string) ?? null,
      municipality: (dest.municipalityName as string) ?? null,
      countryCode: (dest.countryCode as string) ?? null,
      averageDailyFlights:
        typeof row.averageDailyFlights === 'number' ? (row.averageDailyFlights as number) : null,
      operators: ops.map((o) => ({
        name: (o.name as string) ?? null,
        iata: (o.iata as string) ?? null,
        icao: (o.icao as string) ?? null,
      })),
    };
  });
  return { routes, status: res.status, raw: d };
}

/**
 * Does `carrier` appear in this route's operator list?
 *
 * Matches on the airline NAME as well as its codes, because the same brand flies
 * under several AOCs with different codes and any single-code check produces a
 * false negative on the weeks the other AOC operates. "wizz" matches Wizz Air,
 * Wizz Air Malta and Wizz Air UK; "W6" alone would not.
 */
export function operatedBy(route: RouteRecord, carrier: string): boolean {
  const q = carrier.trim().toLowerCase();
  if (!q) return false;
  return route.operators.some((o) => {
    const name = (o.name || '').toLowerCase();
    if (name && (name.includes(q) || q.includes(name))) return true;
    return [o.iata, o.icao].some((c) => !!c && c.toLowerCase() === q);
  });
}

/**
 * Every distinct airline across a set of routes, with the codes it appears
 * under and how many routes it flies.
 *
 * This is the diagnostic that decides whether a route lookup is usable at all.
 * If the same brand shows up as several entries — Wizz Air and Wizz Air Malta,
 * Ryanair and Buzz — then no matcher keyed on a single code can work, and that
 * has to be designed for rather than discovered in production.
 */
export function operatorInventory(
  routes: RouteRecord[],
): { name: string; codes: string[]; routes: number }[] {
  const seen = new Map<string, { name: string; codes: Set<string>; routes: number }>();
  for (const r of routes) {
    for (const o of r.operators) {
      const key = (o.name || o.iata || o.icao || '').toLowerCase();
      if (!key) continue;
      const row = seen.get(key) || { name: o.name || key, codes: new Set<string>(), routes: 0 };
      if (o.iata) row.codes.add(o.iata);
      if (o.icao) row.codes.add(o.icao);
      row.routes += 1;
      seen.set(key, row);
    }
  }
  return [...seen.values()]
    .map((v) => ({ name: v.name, codes: [...v.codes], routes: v.routes }))
    .sort((a, b) => b.routes - a.routes);
}

/** The route from an already-fetched list, or null if it did not fly this week. */
export function findRoute(routes: RouteRecord[], destIata: string): RouteRecord | null {
  const q = destIata.trim().toUpperCase();
  return routes.find((r) => (r.iata || '').toUpperCase() === q) ?? null;
}

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
 */
export async function fetchFlight(
  carrier: string,
  number: string,
  dateLocal: string,
): Promise<Record<string, unknown> | null> {
  const flightNo = `${carrier}${number}`;
  const url = `${ADA_BASE}/flights/number/${encodeURIComponent(flightNo)}/${dateLocal}?dateLocalRole=Departure`;
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

// --- helpers to read nested movement fields ---------------------------------

function airportField(mv: Record<string, unknown> | undefined, key: string): string | undefined {
  const ap = mv?.airport as Record<string, unknown> | undefined;
  const v = ap?.[key];
  return typeof v === 'string' && v.length ? v : undefined;
}

/** Prefer revised (live) time, fall back to scheduled. Returns UTC ISO or undefined. */
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
 * Times: we expose BOTH scheduled and revised. `est*Time` is revised-or-
 * scheduled (a sensible single value for storage/display); `sched*Time` is the
 * scheduled baseline so the UI can show a strike-through only when revised
 * genuinely differs. IATA is for display; ICAO is kept for the coverage call.
 */
export interface NormalisedFlight {
  statusCode: FlightStatusCode;

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
}

export function normaliseFlight(f: Record<string, unknown> | null): NormalisedFlight | null {
  if (!f) return null;
  const dep = (f.departure || undefined) as Record<string, unknown> | undefined;
  const arr = (f.arrival || undefined) as Record<string, unknown> | undefined;

  const depT = movementTime(dep);
  const arrT = movementTime(arr);

  return {
    statusCode: mapStatus(f.status as string),

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
  };
}

export { ADA_BASE };

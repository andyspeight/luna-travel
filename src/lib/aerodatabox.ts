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

/** Free-tier coverage check: does this airport have live flight updates? */
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

/**
 * Normalise a raw AeroDataBox flight object into the fields the UI cares about.
 * Pure mapping, no fetch — safe to reuse anywhere.
 */
export interface NormalisedFlight {
  statusCode: FlightStatusCode;
  depAirportIcao?: string;
  arrAirportIcao?: string;
  depTerminal?: string;
  depGate?: string;
  arrTerminal?: string;
  baggageBelt?: string;
  checkInDesk?: string;
  estDepTime?: string;
  estArrTime?: string;
}

export function normaliseFlight(f: Record<string, unknown> | null): NormalisedFlight | null {
  if (!f) return null;
  const dep = (f.departure || undefined) as Record<string, unknown> | undefined;
  const arr = (f.arrival || undefined) as Record<string, unknown> | undefined;
  return {
    statusCode: mapStatus(f.status as string),
    depAirportIcao: ((dep?.airport as Record<string, unknown>)?.icao as string) ?? undefined,
    arrAirportIcao: ((arr?.airport as Record<string, unknown>)?.icao as string) ?? undefined,
    depTerminal: (dep?.terminal as string) ?? undefined,
    depGate: (dep?.gate as string) ?? undefined,
    arrTerminal: (arr?.terminal as string) ?? undefined,
    baggageBelt: (arr?.baggageBelt as string) ?? undefined,
    checkInDesk: (dep?.checkInDesk as string) ?? undefined,
    estDepTime: (((dep?.revisedTime as Record<string, unknown>) || {}).utc as string) ?? undefined,
    estArrTime: (((arr?.revisedTime as Record<string, unknown>) || {}).utc as string) ?? undefined,
  };
}

export { ADA_BASE };

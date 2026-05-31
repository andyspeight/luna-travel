/**
 * POST /api/flights/subscribe
 *
 * Luna Travel — Flight Hub Phase 1.
 * Resolves one or more booked FlightLegs against AeroDataBox, checks live
 * coverage for the route, registers a credit-based web-hook subscription, and
 * upserts the live-status row into luna_travel.trip_flights.
 *
 * Called server-side (on trip view, or by the upcoming-trips cron). Not a
 * public traveller endpoint — guarded by the internal key, same pattern as the
 * Control internal routes.
 *
 * Conventions honoured:
 *  - AeroDataBox key read from env only (AERODATABOX_API_KEY), never client-side.
 *  - Supabase via getSupabaseAdmin (service role). That client is already
 *    configured with db.schema = 'luna_travel', so we call .from() directly.
 *  - No signature from AeroDataBox exists, so the webhook URL carries a secret
 *    token (AERODATABOX_WEBHOOK_TOKEN) which the webhook route checks.
 *  - All inputs validated before any outbound call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { FlightStatusCode } from '@/types/booking';

// ---- Config (the only AeroDataBox wiring; all from env) --------------------
const ADA_BASE = 'https://prod.api.market/api/v1/aedbx/aerodatabox';
const ADA_KEY = process.env.AERODATABOX_API_KEY || '';
const WEBHOOK_BASE = process.env.LUNA_TRAVEL_PUBLIC_URL || ''; // e.g. https://lunatravel.travelify.io
const WEBHOOK_TOKEN = process.env.AERODATABOX_WEBHOOK_TOKEN || '';
const INTERNAL_KEY = process.env.TG_INTERNAL_KEY || '';

// ---- Helpers ---------------------------------------------------------------

function adaHeaders() {
  return { 'x-api-market-key': ADA_KEY, Accept: 'application/json' };
}

/** AeroDataBox FlightStatus -> our FlightStatusCode. */
function mapStatus(s?: string): FlightStatusCode {
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

const AIRLINE_RE = /^[A-Z0-9]{2,3}$/;
const FLIGHTNO_RE = /^\d{1,4}[A-Z]?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface SubscribeLeg {
  flightLegId: string;
  carrierCode: string;
  flightNumber: string;
  depDateLocal: string;   // YYYY-MM-DD
  depAirportIata?: string;
  arrAirportIata?: string;
}

/** Look up a single flight's current status on its departure date. */
async function fetchFlight(carrier: string, number: string, dateLocal: string) {
  const flightNo = `${carrier}${number}`;
  const url = `${ADA_BASE}/flights/number/${encodeURIComponent(flightNo)}/${dateLocal}?dateLocalRole=Departure`;
  const res = await fetch(url, { headers: adaHeaders() });
  if (res.status === 204) return null;           // no flight that day
  if (!res.ok) throw new Error(`ADA flight lookup ${res.status}`);
  const arr = await res.json();
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

/** Free-tier coverage check: does this airport have live flight updates? */
async function hasLiveFeed(icao?: string): Promise<boolean> {
  if (!icao) return false;
  try {
    const res = await fetch(
      `${ADA_BASE}/health/services/airports/${encodeURIComponent(icao)}/feeds`,
      { headers: adaHeaders() },
    );
    if (!res.ok) return false;
    const data = await res.json();
    const status = data?.liveFlightUpdatesFeed?.status;
    return status === 'OK' || status === 'OKPartial';
  } catch {
    return false;
  }
}

/** Register a credit-based web-hook subscription for this flight number. */
async function createSubscription(carrier: string, number: string): Promise<string | null> {
  if (!WEBHOOK_BASE || !WEBHOOK_TOKEN) return null; // can't subscribe without a callback URL yet
  const subjectId = `${carrier}${number}`;
  const url = `${ADA_BASE}/subscriptions/webhook/FlightByNumber/${encodeURIComponent(subjectId)}`;
  const callback = `${WEBHOOK_BASE}/api/flights/webhook?t=${encodeURIComponent(WEBHOOK_TOKEN)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...adaHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: callback, maxDeliveryRetries: 1 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // 200 returns SubscriptionContract; 199 returns FlightNotificationContract w/ subscription
  return data?.id || data?.subscription?.id || null;
}

// ---- Route -----------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Internal-only guard
  if (!INTERNAL_KEY || req.headers.get('x-tg-internal-key') !== INTERNAL_KEY) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!ADA_KEY) {
    return NextResponse.json({ ok: false, error: 'flight api not configured' }, { status: 503 });
  }

  let body: { agencyId?: string; bookingRef?: string; legs?: SubscribeLeg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const { agencyId, bookingRef, legs } = body;
  if (!agencyId || !bookingRef || !Array.isArray(legs) || legs.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const results: Array<{ flightLegId: string; ok: boolean; reason?: string }> = [];

  for (const leg of legs) {
    const carrier = (leg.carrierCode || '').toUpperCase().trim();
    const number = (leg.flightNumber || '').toUpperCase().trim();
    const date = (leg.depDateLocal || '').trim();

    // Validate before any outbound call
    if (!leg.flightLegId || !AIRLINE_RE.test(carrier) || !FLIGHTNO_RE.test(number) || !DATE_RE.test(date)) {
      results.push({ flightLegId: leg.flightLegId || '?', ok: false, reason: 'invalid leg' });
      continue;
    }

    try {
      const flight = await fetchFlight(carrier, number, date);

      const depIcao = flight?.departure?.airport?.icao || undefined;
      const arrIcao = flight?.arrival?.airport?.icao || undefined;
      const coverage = (await hasLiveFeed(depIcao)) || (await hasLiveFeed(arrIcao));

      // Only register a live webhook if there's a chance of updates
      const subscriptionId = coverage ? await createSubscription(carrier, number) : null;

      const row = {
        agency_id: agencyId,
        booking_ref: bookingRef,
        flight_leg_id: leg.flightLegId,
        carrier_code: carrier,
        flight_number: number.replace(/[A-Z]$/, ''),
        dep_date_local: date,
        status_code: mapStatus(flight?.status),
        est_dep_time: flight?.departure?.revisedTime?.utc ?? null,
        est_arr_time: flight?.arrival?.revisedTime?.utc ?? null,
        dep_terminal_live: flight?.departure?.terminal ?? null,
        dep_gate: flight?.departure?.gate ?? null,
        arr_terminal_live: flight?.arrival?.terminal ?? null,
        baggage_belt: flight?.arrival?.baggageBelt ?? null,
        check_in_desk: flight?.departure?.checkInDesk ?? null,
        ada_subscription_id: subscriptionId,
        dep_airport_icao: depIcao ?? null,
        arr_airport_icao: arrIcao ?? null,
        has_live_coverage: coverage,
        watch_state: subscriptionId ? 'active' : 'pending',
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('trip_flights')
        .upsert(row, { onConflict: 'booking_ref,flight_leg_id' });

      if (error) {
        results.push({ flightLegId: leg.flightLegId, ok: false, reason: 'db error' });
      } else {
        results.push({ flightLegId: leg.flightLegId, ok: true });
      }
    } catch (err) {
      // Fail closed per leg; one bad leg never blocks the others
      results.push({ flightLegId: leg.flightLegId, ok: false, reason: 'lookup failed' });
    }
  }

  return NextResponse.json({ ok: true, results });
}

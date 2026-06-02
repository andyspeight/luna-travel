/**
 * POST /api/flights/subscribe
 *
 * Luna Travel — Flight Hub. Resolves booked FlightLegs against AeroDataBox,
 * checks live coverage, registers a credit-based web-hook subscription, and
 * upserts the live-status row into luna_travel.trip_flights.
 *
 * Internal-only (x-tg-internal-key). Uses the shared @/lib/aerodatabox client
 * so the AeroDataBox base URL, key, status mapping and lookups live in one place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  adaConfigured,
  fetchFlight,
  hasLiveFeed,
  createSubscription,
  normaliseFlight,
} from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEBHOOK_BASE = process.env.LUNA_TRAVEL_PUBLIC_URL || '';
const WEBHOOK_TOKEN = process.env.AERODATABOX_WEBHOOK_TOKEN || '';
const INTERNAL_KEY = process.env.TG_INTERNAL_KEY || '';

const AIRLINE_RE = /^[A-Z0-9]{2,3}$/;
const FLIGHTNO_RE = /^\d{1,4}[A-Z]?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface SubscribeLeg {
  flightLegId: string;
  carrierCode: string;
  flightNumber: string;
  depDateLocal: string;
}

export async function POST(req: NextRequest) {
  if (!INTERNAL_KEY || req.headers.get('x-tg-internal-key') !== INTERNAL_KEY) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!adaConfigured()) {
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

    if (!leg.flightLegId || !AIRLINE_RE.test(carrier) || !FLIGHTNO_RE.test(number) || !DATE_RE.test(date)) {
      results.push({ flightLegId: leg.flightLegId || '?', ok: false, reason: 'invalid leg' });
      continue;
    }

    try {
      const raw = await fetchFlight(carrier, number, date);
      const n = normaliseFlight(raw);

      const depIcao = n?.depAirportIcao;
      const arrIcao = n?.arrAirportIcao;
      const coverage = (await hasLiveFeed(depIcao)) || (await hasLiveFeed(arrIcao));

      const subscriptionId = coverage
        ? await createSubscription(carrier, number, WEBHOOK_BASE, WEBHOOK_TOKEN)
        : null;

      const row = {
        agency_id: agencyId,
        booking_ref: bookingRef,
        flight_leg_id: leg.flightLegId,
        carrier_code: carrier,
        flight_number: number.replace(/[A-Z]$/, ''),
        dep_date_local: date,
        status_code: n?.statusCode ?? 'Unknown',
        est_dep_time: n?.estDepTime ?? null,
        est_arr_time: n?.estArrTime ?? null,
        dep_terminal_live: n?.depTerminal ?? null,
        dep_gate: n?.depGate ?? null,
        arr_terminal_live: n?.arrTerminal ?? null,
        baggage_belt: n?.baggageBelt ?? null,
        check_in_desk: n?.checkInDesk ?? null,
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

      results.push(
        error
          ? { flightLegId: leg.flightLegId, ok: false, reason: 'db error' }
          : { flightLegId: leg.flightLegId, ok: true },
      );
    } catch {
      results.push({ flightLegId: leg.flightLegId, ok: false, reason: 'lookup failed' });
    }
  }

  return NextResponse.json({ ok: true, results });
}

/**
 * POST /api/flights/webhook?t=<AERODATABOX_WEBHOOK_TOKEN>
 *
 * Luna Travel — Flight Hub Phase 1. Inbound endpoint AeroDataBox calls when a
 * subscribed flight updates. AeroDataBox does NOT sign its callbacks, so the
 * only auth is the secret token in the query string (set at subscribe time).
 *
 * Flow:
 *   1. Verify the ?t= token (constant-time compare). Reject otherwise.
 *   2. Parse FlightNotificationContract: { flights[], subscription, balance }.
 *   3. For each flight item, find every trip_flights row on this subscription,
 *      diff the new state, update the row.
 *   4. On a MEANINGFUL change, emit one flight-category message per affected
 *      traveller via the existing messages + message_recipients pipeline, AND
 *      wake their devices with a Web Push notification.
 *
 * One inbound alert can fan out to several travellers (subscription is by flight
 * number; multiple bookings may share a flight).
 *
 * Built on the pre-existing luna_travel.messages + message_recipients schema,
 * matching the send pattern in admin/agencies/[id]/messages/route.ts.
 *
 * The push matters more here than anywhere else in the app. A cancellation at
 * 2am that only writes a message row is a message nobody reads until morning,
 * which is exactly when it is no longer useful. What to say and how loudly is
 * decided in src/lib/flight-alerts.ts, which is pure and tested; this file does
 * the I/O.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendPushToTravellers } from '@/lib/push';
import {
  mapStatus,
  priorityFor,
  buildMessage,
  isMeaningfulChange,
  pushForFlightAlert,
  type FlightSnapshot,
} from '@/lib/flight-alerts';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// One inbound alert can touch several bookings, and each one now sends to every
// device its travellers own. Sends are awaited (see below), so give the
// invocation room rather than having it cut off mid-fan-out.
export const maxDuration = 60;

const WEBHOOK_TOKEN = process.env.AERODATABOX_WEBHOOK_TOKEN || '';

// ---- Token check (constant time) -------------------------------------------
function tokenValid(provided: string): boolean {
  if (!WEBHOOK_TOKEN || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Display names for the agencies in this callback, keyed by id.
 *
 * Best effort by design: a lookup failure must not cost a traveller their
 * cancellation notice, so it returns an empty map and the notification falls
 * back to generic wording rather than not being sent.
 */
async function agencyNameMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agencyIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!agencyIds.length) return names;
  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name')
      .in('id', agencyIds);
    if (error) {
      console.error('[flights.webhook] agency names', error.message);
      return names;
    }
    for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
      if (row.name) names.set(row.id, row.name);
    }
  } catch (e) {
    console.error('[flights.webhook] agency names threw', e instanceof Error ? e.message : e);
  }
  return names;
}

export async function POST(req: NextRequest) {
  // 1) token
  const token = new URL(req.url).searchParams.get('t') || '';
  if (!tokenValid(token)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2) parse
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const flights = Array.isArray(payload.flights) ? (payload.flights as Array<Record<string, unknown>>) : [];
  const subscription = (payload.subscription || {}) as Record<string, unknown>;
  const subscriptionId = (subscription.id as string) || '';
  if (!subscriptionId || flights.length === 0) {
    // Acknowledge so AeroDataBox doesn't retry a payload we can't use.
    return NextResponse.json({ ok: true, note: 'nothing to do' });
  }

  const supabase = getSupabaseAdmin();

  // All trip_flights rows watching this subscription (may be several bookings).
  const { data: rows, error: rowErr } = await supabase
    .from('trip_flights')
    .select('id, agency_id, booking_ref, flight_leg_id, carrier_code, flight_number, status_code, dep_gate, dep_terminal_live, baggage_belt')
    .eq('ada_subscription_id', subscriptionId);
  if (rowErr) {
    console.error('[flights.webhook] rows', rowErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const tripRows = (rows || []) as Array<Record<string, unknown>>;
  if (tripRows.length === 0) {
    return NextResponse.json({ ok: true, note: 'no matching trips' });
  }

  // Use the first (most-updated) flight item in the notification.
  const f = flights[0];
  const dep = (f.departure || undefined) as Record<string, unknown> | undefined;
  const arr = (f.arrival || undefined) as Record<string, unknown> | undefined;
  const status = mapStatus(f.status as string);
  const nextGate = (dep?.gate as string | null) ?? null;
  const nextDepTerminal = (dep?.terminal as string | null) ?? null;
  const nextArrTerminal = (arr?.terminal as string | null) ?? null;
  const nextBelt = (arr?.baggageBelt as string | null) ?? null;
  const nextCheckIn = (dep?.checkInDesk as string | null) ?? null;
  const estDep = (((dep?.revisedTime as Record<string, unknown>) || {}).utc as string | null) ?? null;
  const estArr = (((arr?.revisedTime as Record<string, unknown>) || {}).utc as string | null) ?? null;
  const summary = (f.notificationSummary as string | null) ?? undefined;

  // The provider reports one flight; every watching row is compared against it.
  const next: FlightSnapshot = {
    statusCode: status,
    depGate: nextGate,
    depTerminal: nextDepTerminal,
    baggageBelt: nextBelt,
  };

  // Agency names for the notification title. Resolved once per callback rather
  // than per row, and only for Luna-store agencies — a Control-sourced agency
  // carries its name in session claims, which a webhook has none of, so those
  // fall back inside pushForFlightAlert.
  const agencyNames = await agencyNameMap(
    supabase,
    [...new Set(tripRows.map((r) => r.agency_id as string))],
  );

  const nowIso = new Date().toISOString();
  let updated = 0;
  let messaged = 0;
  let pushed = 0;

  for (const row of tripRows) {
    const carrierFlight = `${row.carrier_code}${row.flight_number}`;
    const meaningful = isMeaningfulChange(
      {
        statusCode: row.status_code as FlightSnapshot['statusCode'],
        depGate: (row.dep_gate as string | null) ?? null,
        depTerminal: (row.dep_terminal_live as string | null) ?? null,
        baggageBelt: (row.baggage_belt as string | null) ?? null,
      },
      next,
    );

    // Update the live row regardless (keep it fresh even on minor ticks)
    const { error: updErr } = await supabase
      .from('trip_flights')
      .update({
        status_code: status,
        est_dep_time: estDep,
        est_arr_time: estArr,
        dep_gate: nextGate,
        dep_terminal_live: nextDepTerminal,
        arr_terminal_live: nextArrTerminal,
        baggage_belt: nextBelt,
        check_in_desk: nextCheckIn,
        last_updated: nowIso,
      })
      .eq('id', row.id as string);
    if (updErr) {
      console.error('[flights.webhook] update', updErr.message);
      continue;
    }
    updated++;

    if (!meaningful) continue;

    const msg = buildMessage(
      carrierFlight,
      status,
      { gate: nextGate, depTerminal: nextDepTerminal, baggageBelt: nextBelt },
      summary,
    );
    if (!msg) continue;

    // Find the travellers on this booking to message them.
    const { data: travs, error: travErr } = await supabase
      .from('travellers')
      .select('id')
      .eq('agency_id', row.agency_id as string)
      .eq('booking_ref', row.booking_ref as string);
    if (travErr || !travs || travs.length === 0) continue;

    // 1) message content (one per booking per meaningful change)
    const { data: created, error: msgErr } = await supabase
      .from('messages')
      .insert({
        agency_id: row.agency_id,
        direction: 'agency_to_traveller',
        category: 'flight',
        subject: msg.subject,
        body: msg.body,
        attachments: [],
        priority: priorityFor(status),
        targeting: { type: 'travellers', travellerIds: (travs as Array<Record<string, unknown>>).map((t) => t.id) },
        sent_by: 'system:flight',
      })
      .select('id')
      .single();
    if (msgErr || !created) {
      console.error('[flights.webhook] insert message', msgErr?.message);
      continue;
    }
    const messageId = (created as Record<string, unknown>).id as string;

    // 2) one recipient row per traveller
    const recipientRows = (travs as Array<Record<string, unknown>>).map((t) => ({
      message_id: messageId,
      traveller_id: t.id,
      delivery_status: 'delivered',
      delivered_at: nowIso,
    }));
    const { error: recErr } = await supabase.from('message_recipients').insert(recipientRows);
    if (recErr) {
      console.error('[flights.webhook] insert recipients', recErr.message);
      await supabase.from('messages').delete().eq('id', messageId); // no orphan
      continue;
    }
    messaged++;

    // 3) wake the devices.
    //
    // AWAITED, not fire-and-forget. Vercel freezes the invocation the moment
    // the response is returned, so a pending promise is killed before it runs —
    // the same trap that silently disabled notifications on the agency message
    // path. sendPushToTravellers never throws and runs ten at a time, so the
    // worst case is a slower 200 back to AeroDataBox, never a lost update: the
    // message row is already committed above.
    const travellerIds = (travs as Array<Record<string, unknown>>).map((t) => t.id as string);
    const result = await sendPushToTravellers(
      travellerIds,
      pushForFlightAlert({
        agencyName: agencyNames.get(row.agency_id as string),
        flightLegId: row.flight_leg_id as string,
        body: msg.body,
        priority: priorityFor(status),
      }),
    );
    pushed += result.sent;
    console.log('[flights.webhook] push', {
      bookingRef: row.booking_ref,
      leg: carrierFlight,
      status,
      travellers: travellerIds.length,
      sent: result.sent,
    });
  }

  return NextResponse.json({ ok: true, updated, messaged, pushed });
}

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
 *      traveller via the existing messages + message_recipients pipeline.
 *
 * One inbound alert can fan out to several travellers (subscription is by flight
 * number; multiple bookings may share a flight).
 *
 * Built on the pre-existing luna_travel.messages + message_recipients schema,
 * matching the send pattern in admin/agencies/[id]/messages/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { FlightStatusCode } from '@/types/booking';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEBHOOK_TOKEN = process.env.AERODATABOX_WEBHOOK_TOKEN || '';

// ---- Token check (constant time) -------------------------------------------
function tokenValid(provided: string): boolean {
  if (!WEBHOOK_TOKEN || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---- Status mapping (AeroDataBox FlightStatus -> ours) ---------------------
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

// Priority for the traveller-facing message, by status.
function priorityFor(status: FlightStatusCode): 'info' | 'important' | 'urgent' {
  if (status === 'Cancelled' || status === 'Diverted') return 'urgent';
  if (status === 'Boarding' || status === 'GateClosed' || status === 'Delayed') return 'important';
  return 'info';
}

// Build a short human message. AeroDataBox gives notificationSummary; prefer it.
function buildMessage(
  carrierFlight: string,
  status: FlightStatusCode,
  dep: Record<string, unknown> | undefined,
  arr: Record<string, unknown> | undefined,
  summary?: string,
): { subject: string; body: string } | null {
  const gate = (dep?.gate as string | null) || null;
  const depTerminal = (dep?.terminal as string | null) || null;
  const belt = (arr?.baggageBelt as string | null) || null;

  let body = '';
  switch (status) {
    case 'CheckIn': body = `Check-in is open for ${carrierFlight}.`; break;
    case 'Boarding': body = gate ? `${carrierFlight} is boarding at gate ${gate}.` : `${carrierFlight} is boarding now.`; break;
    case 'GateClosed': body = `The gate for ${carrierFlight} has closed.`; break;
    case 'Delayed': body = `${carrierFlight} is delayed. Check the app for the latest time.`; break;
    case 'Departed': body = `${carrierFlight} has departed.`; break;
    case 'Approaching': body = `${carrierFlight} is on approach.`; break;
    case 'Landed': body = belt ? `${carrierFlight} has landed. Baggage on belt ${belt}.` : `${carrierFlight} has landed.`; break;
    case 'Cancelled': body = `${carrierFlight} has been cancelled. Please contact your agent.`; break;
    case 'Diverted': body = `${carrierFlight} has been diverted. Please contact your agent.`; break;
    case 'CancelledUncertain': body = `There may be a disruption to ${carrierFlight}. Check the app for updates.`; break;
    default: return null; // Scheduled/Unknown alone isn't worth a push
  }
  // If the provider gave a richer summary, use it as the body instead.
  if (summary && summary.trim().length > 0) body = summary.trim();

  let subject = `${carrierFlight} update`;
  if (status === 'Boarding' && gate) subject = `Gate ${gate} — boarding`;
  else if (depTerminal && (status === 'CheckIn')) subject = `Check-in open — Terminal ${depTerminal}`;
  else if (status === 'Cancelled' || status === 'Diverted') subject = `${carrierFlight} — important`;

  return { subject, body };
}

// Decide if the change is worth alerting on (vs a no-op tick).
function isMeaningful(
  prev: Record<string, unknown>,
  nextStatus: FlightStatusCode,
  nextGate: string | null,
  nextDepTerminal: string | null,
  nextBelt: string | null,
): boolean {
  if ((prev.status_code as string) !== nextStatus) return true;
  if ((prev.dep_gate as string | null) !== nextGate && nextGate) return true;
  if ((prev.dep_terminal_live as string | null) !== nextDepTerminal && nextDepTerminal) return true;
  if ((prev.baggage_belt as string | null) !== nextBelt && nextBelt) return true;
  return false;
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

  const nowIso = new Date().toISOString();
  let updated = 0;
  let messaged = 0;

  for (const row of tripRows) {
    const carrierFlight = `${row.carrier_code}${row.flight_number}`;
    const meaningful = isMeaningful(row, status, nextGate, nextDepTerminal, nextBelt);

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

    const msg = buildMessage(carrierFlight, status, dep, arr, summary);
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
  }

  return NextResponse.json({ ok: true, updated, messaged });
}

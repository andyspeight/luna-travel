/**
 * Travelify sync engine — server-only.
 *
 * Re-pulls a traveller's booking from Travelify, classifies the outcome, and
 * records it as a row in luna_travel.sync_events for the admin Sync monitor.
 *
 * v1 uses the demo Travelify integration (the only working path today via
 * src/lib/travelify.ts). It becomes genuinely per-agency the moment per-agency
 * credentials land (the held "#4"): swap lookupBooking's credential source and
 * this engine is multi-agency with no other change.
 *
 * Everything here is best-effort: a failed lookup is itself a recorded sync
 * event (that's the point of a health monitor), and a DB write failure logs and
 * returns null rather than throwing.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { lookupBooking } from '@/lib/travelify';

export type SyncStatus = 'success' | 'partial' | 'failed';
export type SyncSource = 'cron' | 'manual' | 'redeem';

export interface SyncBookingInput {
  travellerId: string;
  agencyId: string;
  bookingRef: string;
  email: string;
  departureDate: string | null;
}

export interface SyncEventRecord {
  id: string;
  agencyId: string;
  bookingRef: string;
  status: SyncStatus;
  detail: string;
  errorCode: string | null;
  durationMs: number;
  documentsAdded: number;
  source: SyncSource;
  syncedAt: string;
}

interface TravellerRow {
  id: string;
  agency_id: string;
  booking_ref: string;
  email: string;
  departure_date: string | null;
}

function classifyFailure(reason: 'not_found' | 'config' | 'server'): { detail: string; errorCode: string } {
  switch (reason) {
    case 'not_found': return { detail: 'Booking not found in Travelify', errorCode: '404' };
    case 'config': return { detail: 'Travelify credentials need attention', errorCode: '401' };
    default: return { detail: 'Travelify upstream error', errorCode: '500' };
  }
}

/** Re-pull one booking and record the outcome. Returns the written event. */
export async function syncBooking(input: SyncBookingInput, source: SyncSource): Promise<SyncEventRecord | null> {
  const supabase = getSupabaseAdmin();
  const start = Date.now();

  let status: SyncStatus = 'failed';
  let detail = 'Sync did not complete';
  let errorCode: string | null = null;

  try {
    const res = await lookupBooking({
      bookingRef: input.bookingRef,
      email: input.email,
      departureDate: (input.departureDate || '').slice(0, 10),
    });
    if (res.ok) {
      status = 'success';
      // The booking still has flights when sold with them; a hotel-only or
      // empty payload is a successful-but-thin refresh worth flagging.
      const b = res.booking;
      const thin = !b.destination && !b.departureDate;
      status = thin ? 'partial' : 'success';
      detail = thin ? 'Booking refreshed — limited data returned' : 'Booking refreshed from Travelify';
    } else {
      const c = classifyFailure(res.reason);
      detail = c.detail;
      errorCode = c.errorCode;
    }
  } catch (e) {
    detail = `Sync error: ${(e as Error).message.slice(0, 120)}`;
    errorCode = 'ERR';
  }

  const durationMs = Date.now() - start;

  const { data, error } = await supabase
    .from('sync_events')
    .insert({
      agency_id: input.agencyId,
      booking_ref: input.bookingRef,
      traveller_id: input.travellerId,
      status,
      detail,
      error_code: errorCode,
      duration_ms: durationMs,
      documents_added: 0,
      source,
    })
    .select('id, synced_at')
    .single();

  if (error || !data) {
    console.error('[sync] insert failed:', error?.message);
    return null;
  }

  return {
    id: data.id as string,
    agencyId: input.agencyId,
    bookingRef: input.bookingRef,
    status,
    detail,
    errorCode,
    durationMs,
    documentsAdded: 0,
    source,
    syncedAt: data.synced_at as string,
  };
}

/** Sweep every active traveller's booking. Sequential to be gentle on Travelify. */
export async function runSyncSweep(source: SyncSource = 'cron'): Promise<{
  total: number;
  success: number;
  partial: number;
  failed: number;
}> {
  const supabase = getSupabaseAdmin();
  const summary = { total: 0, success: 0, partial: 0, failed: 0 };

  const { data, error } = await supabase
    .from('travellers')
    .select('id, agency_id, booking_ref, email, departure_date')
    .eq('status', 'active');
  if (error || !data) {
    console.error('[sync] traveller fetch failed:', error?.message);
    return summary;
  }

  for (const t of data as TravellerRow[]) {
    const ev = await syncBooking(
      {
        travellerId: t.id,
        agencyId: t.agency_id,
        bookingRef: t.booking_ref,
        email: t.email,
        departureDate: t.departure_date,
      },
      source,
    );
    summary.total++;
    if (ev?.status === 'success') summary.success++;
    else if (ev?.status === 'partial') summary.partial++;
    else summary.failed++;
  }

  return summary;
}

/** Look up a single traveller (for the manual re-sync button). */
export async function getTraveller(travellerId: string): Promise<TravellerRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('travellers')
    .select('id, agency_id, booking_ref, email, departure_date')
    .eq('id', travellerId)
    .single();
  if (error || !data) return null;
  return data as TravellerRow;
}

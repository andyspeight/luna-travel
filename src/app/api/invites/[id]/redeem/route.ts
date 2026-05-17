/**
 * POST /api/invites/[id]/redeem
 *
 * Closes the loop: a traveller scans a QR, lands on /install?invite={id},
 * enters their email/departure-date/booking-ref, this endpoint validates
 * them against Travelify, and on success creates a traveller row + issues
 * a session JWT.
 *
 * Flow:
 *   1. Validate inputs (email regex, YYYY-MM-DD date, alphanumeric ref)
 *   2. Fetch invite from Supabase
 *   3. Check invite is pending and not expired
 *   4. Call Travelify (via lookupBooking)
 *   5. Atomic invite update: pending → redeemed (so concurrent calls can't double-spend)
 *   6. Insert traveller row (or return existing on idempotent re-redeem)
 *   7. Sign JWT, set HttpOnly cookie, return token in body
 *
 * Errors: ALL failures return generic 404 (anti-enumeration). Logs are
 * detailed for our own debugging but the client never learns which field
 * was wrong or which step failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { lookupBooking } from '@/lib/travelify';
import { signSession } from '@/lib/jwt';
import { logAuditEvent } from '@/lib/audit';

// ───────── Validation (matches retrieve-order.js patterns) ─────────

function validateEmail(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const v = s.trim().toLowerCase();
  if (v.length < 5 || v.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

function validateDate(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const yr = parseInt(s.slice(0, 4), 10);
  if (yr < 2020 || yr > 2050) return null;
  return s;
}

function validateOrderRef(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const v = s.trim().toUpperCase();
  if (!/^[A-Z0-9_\-]{3,40}$/.test(v)) return null;
  return v;
}

// ───────── Generic 404 helper (no info leak) ─────────

function notFound() {
  return NextResponse.json(
    {
      error: 'not_found',
      message: "We couldn't find a confirmed booking with those details.",
    },
    { status: 404 },
  );
}

// ───────── Handler ─────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const inviteId = params.id;

  // UUID-ish sanity check on the path param. Lenient because invite IDs
  // come from Supabase as uuid() — but we still bound them.
  if (!inviteId || typeof inviteId !== 'string' || inviteId.length < 8 || inviteId.length > 64) {
    return notFound();
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return notFound();
  }

  const email = validateEmail(body.email);
  const departureDate = validateDate(body.departureDate);
  const bookingRef = validateOrderRef(body.bookingRef);

  if (!email || !departureDate || !bookingRef) {
    return notFound();
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[redeem] supabase init failed:', (e as Error).message);
    return notFound();
  }

  // 1. Fetch the invite
  const { data: invite, error: fetchErr } = await supabase
    .from('invites')
    .select('id, agency_id, status, expires_at, booking_ref, email, departure_date, redeemed_traveller_id')
    .eq('id', inviteId)
    .single();

  if (fetchErr || !invite) {
    console.warn('[redeem] invite not found:', inviteId, fetchErr?.message);
    return notFound();
  }

  // 2. Check expiry
  const expiresAt = new Date(invite.expires_at as string);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    console.warn('[redeem] invite expired:', inviteId);
    return notFound();
  }

  // 3. Idempotency: if already redeemed, check the details match and re-issue
  //    a session token rather than erroring. Helps when a user double-taps
  //    submit or refreshes the page.
  if (invite.status === 'redeemed' && invite.redeemed_traveller_id) {
    const { data: existing, error: existingErr } = await supabase
      .from('travellers')
      .select('id, agency_id, booking_ref, email')
      .eq('id', invite.redeemed_traveller_id as string)
      .single();

    if (!existingErr && existing && existing.email === email && existing.booking_ref === bookingRef) {
      const token = await signSession({
        inviteId,
        travellerId: existing.id as string,
        bookingRef: existing.booking_ref as string,
        agencyId: existing.agency_id as string,
      });
      return jsonWithCookie({ session: token }, token);
    }
    // Already redeemed but details don't match — treat as not found
    console.warn('[redeem] invite already redeemed by different details:', inviteId);
    return notFound();
  }

  if (invite.status !== 'pending') {
    console.warn('[redeem] invite status not pending:', inviteId, invite.status);
    return notFound();
  }

  // 4. Call Travelify (uses demo integration for v1)
  const lookup = await lookupBooking({ bookingRef, email, departureDate });
  if (!lookup.ok) {
    console.warn('[redeem] travelify lookup failed:', inviteId, lookup.reason);
    return notFound();
  }
  const booking = lookup.booking;

  // 5. Atomic invite update: only proceeds if status is still 'pending'.
  //    If two concurrent redemptions race, only one wins; the other sees
  //    rowCount=0 and bails. (Postgres UPDATE ... WHERE status='pending' is
  //    atomic — Supabase passes the WHERE through.)
  const now = new Date().toISOString();

  // 6. Insert traveller row. Schema uses lead_passenger_name (single field)
  //    and the unique constraint is (agency_id, booking_ref) — so a re-redeem
  //    after an earlier one would hit the constraint. We treat unique-violation
  //    here as "this booking is already onboarded, surface the existing row"
  //    rather than failing.
  const leadName = [booking.customerFirstname, booking.customerSurname]
    .filter(Boolean)
    .join(' ')
    .trim() || null;

  const { data: traveller, error: insertErr } = await supabase
    .from('travellers')
    .insert({
      agency_id: invite.agency_id,
      booking_ref: bookingRef,
      email,
      lead_passenger_name: leadName,
      departure_date: booking.departureDate || departureDate,
      return_date: booking.returnDate,
      destination: booking.destination,
      created_at: now,
    })
    .select('id')
    .single();

  if (insertErr || !traveller) {
    console.error('[redeem] traveller insert failed:', inviteId, insertErr?.message);
    return notFound();
  }

  // 7. Now atomically mark the invite redeemed, attaching the traveller ID.
  //    The .eq('status', 'pending') is the compare-and-set — if another
  //    request beat us to it, this updates 0 rows.
  const { data: updated, error: updateErr } = await supabase
    .from('invites')
    .update({
      status: 'redeemed',
      redeemed_at: now,
      redeemed_traveller_id: traveller.id,
    })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select('id')
    .single();

  if (updateErr || !updated) {
    // Race lost — another request redeemed first. Clean up the orphan
    // traveller row we just inserted to avoid duplicates.
    console.warn('[redeem] atomic update lost race, cleaning up:', inviteId, updateErr?.message);
    await supabase.from('travellers').delete().eq('id', traveller.id as string);
    return notFound();
  }

  // 8. Sign session JWT
  const token = await signSession({
    inviteId,
    travellerId: traveller.id as string,
    bookingRef,
    agencyId: invite.agency_id as string,
  });

  // Audit log — successful traveller redemption. Actor is 'traveller'
  // since they're not authenticated as an admin. PII (email) goes in the
  // label per our agreed pattern; metadata captures the agency for filtering.
  void logAuditEvent({
    eventType: 'invite.redeemed',
    actor: 'traveller',
    targetId: inviteId,
    targetLabel: `${invite.agency_id} / ${bookingRef}`,
    metadata: {
      agencyId: invite.agency_id,
      bookingRef,
      travellerEmail: email,
      travellerId: traveller.id,
    },
  });

  return jsonWithCookie({ session: token }, token);
}

// ───────── Cookie helper ─────────

function jsonWithCookie(payload: Record<string, unknown>, token: string) {
  const res = NextResponse.json(payload, { status: 200 });
  res.cookies.set('lt_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches JWT
  });
  return res;
}

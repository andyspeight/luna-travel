/**
 * /api/agency/bookings — the signed-in agency's off-platform trips (bookings not
 * in Travelify). agencyId always comes from the session.
 *
 *   GET  — list this agency's stored bookings.
 *   POST — create one from manual itinerary input (buildManualBooking), store it
 *          in luna_travel.bookings, and open a pending invite so the agency can
 *          send access. Branding for a Luna-native agency is applied at read
 *          time from the override store, so we only need name/email here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';
import { buildManualBooking, type ManualBookingInput } from '@/lib/stored-booking';
import type { ControlAgency } from '@/lib/order-to-booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function genRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LT-${s}`;
}

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('bookings')
    .select('reference, lead_name, lead_email, destination, departure_date, return_date, source, created_at')
    .eq('agency_id', claims.agencyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[agency/bookings] list failed', error.message);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }

  const bookings = ((data ?? []) as Array<Record<string, unknown>>).map((b) => ({
    reference: b.reference,
    leadName: b.lead_name,
    leadEmail: b.lead_email,
    destination: b.destination,
    departureDate: b.departure_date,
    returnDate: b.return_date,
    source: b.source,
    createdAt: b.created_at,
  }));
  return NextResponse.json({ ok: true, bookings });
}

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const agencyRow = await resolvePortalAgency(claims);
  if (!agencyRow || agencyRow.status !== 'live') {
    return NextResponse.json({ error: 'agency_inactive' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const leadFirstName = str(body.leadFirstName);
  const leadLastName = str(body.leadLastName);
  const leadEmail = str(body.leadEmail).toLowerCase();
  const destinationLabel = str(body.destinationLabel);
  const countryCode = str(body.countryCode).toUpperCase();

  if (!leadFirstName || !leadLastName) {
    return NextResponse.json({ error: 'lead_required', message: 'Lead traveller name is required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
    return NextResponse.json({ error: 'email_invalid', message: 'A valid lead email is required' }, { status: 400 });
  }
  if (!destinationLabel) {
    return NextResponse.json({ error: 'destination_required', message: 'Destination is required' }, { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json({ error: 'country_code_invalid', message: 'Country code must be 2 letters (e.g. GR)' }, { status: 400 });
  }

  const flights = Array.isArray(body.flights) ? (body.flights as ManualBookingInput['flights']) : [];
  const hotels = Array.isArray(body.hotels) ? (body.hotels as ManualBookingInput['hotels']) : [];
  if (!flights.length && !hotels.length) {
    return NextResponse.json({ error: 'empty_booking', message: 'Add at least one flight or hotel' }, { status: 400 });
  }

  const input: ManualBookingInput = {
    leadFirstName,
    leadLastName,
    leadEmail,
    destinationLabel,
    countryCode,
    additionalTravellers: Array.isArray(body.additionalTravellers) ? (body.additionalTravellers as ManualBookingInput['additionalTravellers']) : [],
    flights,
    hotels,
    experiences: Array.isArray(body.experiences) ? (body.experiences as ManualBookingInput['experiences']) : [],
  };

  const agency: ControlAgency = { name: agencyRow.name, email: agencyRow.email };

  const supplied = str(body.reference).toUpperCase();
  let reference = supplied || genRef();
  const booking = buildManualBooking(input, agency, reference);
  if (!booking) return NextResponse.json({ error: 'build_failed', message: 'Could not build the itinerary — check dates.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const leadName = `${leadFirstName} ${leadLastName}`.trim();
  const departureDate = booking.tripStart ? booking.tripStart.slice(0, 10) : null;
  const returnDate = booking.tripEnd ? booking.tripEnd.slice(0, 10) : null;

  let inserted = false;
  for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
    booking.reference = reference;
    const { error } = await supabase.from('bookings').insert({
      agency_id: claims.agencyId,
      reference,
      source: 'manual',
      lead_email: leadEmail,
      lead_name: leadName,
      destination: destinationLabel,
      country_code: countryCode,
      departure_date: departureDate,
      return_date: returnDate,
      payload: booking,
      created_by: claims.email,
    });
    if (!error) { inserted = true; break; }
    if ((error as { code?: string }).code === '23505' && !supplied && attempt === 0) {
      reference = genRef();
      continue;
    }
    const conflict = (error as { code?: string }).code === '23505';
    console.error('[agency/bookings] insert failed', error.message);
    return NextResponse.json(
      { error: conflict ? 'reference_exists' : 'insert_failed', message: conflict ? 'That booking reference already exists.' : 'Could not save the trip.' },
      { status: conflict ? 409 : 500 },
    );
  }

  // Open a pending invite so the agency can immediately send access. A failure
  // here is surfaced (inviteError), not swallowed — the trip is already saved.
  let inviteId: string | null = null;
  let inviteError = false;
  try {
    const { data: inv, error: invErr } = await supabase
      .from('invites')
      .insert({
        agency_id: claims.agencyId,
        booking_ref: reference,
        email: leadEmail,
        departure_date: departureDate,
        return_date: returnDate,
        destination: destinationLabel,
        lead_passenger_name: leadName,
        status: 'pending',
        created_by: claims.email,
      })
      .select('id')
      .single();
    if (invErr || !inv) inviteError = true;
    else inviteId = (inv as { id: string }).id;
  } catch {
    inviteError = true;
  }

  const qrUrl = inviteId ? `${req.nextUrl.origin}/install?invite=${inviteId}` : null;
  return NextResponse.json({ ok: true, reference, inviteId, qrUrl, inviteError }, { status: 201 });
}

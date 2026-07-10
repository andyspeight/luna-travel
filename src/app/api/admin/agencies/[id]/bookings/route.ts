/**
 * POST /api/admin/agencies/[id]/bookings
 *
 * Create an OFF-PLATFORM booking (not in Travelify) from manual form input.
 * Stores the Booking payload in luna_travel.bookings and creates a pending
 * invite so the traveller can onboard with a QR. [id] is the agency's Control
 * record id (recXXX). Admin-gated.
 *
 * Body: ManualBookingInput (+ optional reference, agencyName, agencyEmail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-session';
import { buildManualBooking, type ManualBookingInput } from '@/lib/stored-booking';
import type { ControlAgency } from '@/lib/order-to-booking';
import { recordImportCorrection, type ProfileDraft } from '@/lib/pdf-profile';
import { isAgencyId, isControlAgency } from '@/lib/agency-id';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';

/**
 * Best-effort: read the agency's white-label branding from Control so an
 * off-platform booking is branded the same way a live one is (the traveller
 * PWA themes off booking.agency). Uses the admin's forwarded cookie. If Control
 * is unreachable we just proceed with whatever the form supplied — branding is
 * never allowed to block a booking save.
 */
async function loadAgencyBranding(agencyId: string, cookieHeader: string, base: ControlAgency): Promise<ControlAgency> {
  try {
    const res = await fetch(`${CONTROL_HOST}/api/admin/clients/get?id=${encodeURIComponent(agencyId)}`, {
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return base;
    const data = await res.json().catch(() => null);
    const c = ((data?.client ?? {}) as Record<string, unknown>);
    const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
    return {
      ...base,
      name: base.name || s(c.tradingName) || s(c.clientName) || '',
      email: base.email || s(c.primaryEmail) || '',
      website: s(c.websiteUrl) || base.website,
      appName: s(c.appName),
      logoUrl: s(c.logoUrl),
      brandPrimaryColour: s(c.brandPrimaryColour),
      brandAccentColour: s(c.brandAccentColour),
      welcomeMessage: s(c.welcomeMessage),
    };
  } catch {
    return base;
  }
}

function genRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LT-${s}`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const agencyId = (params?.id || '').trim();
  if (!isAgencyId(agencyId)) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // ── Validate the essentials ──
  const leadFirstName = str(body.leadFirstName);
  const leadLastName = str(body.leadLastName);
  const leadEmail = str(body.leadEmail).toLowerCase();
  const destinationLabel = str(body.destinationLabel);
  const countryCode = str(body.countryCode).toUpperCase();

  if (!leadFirstName || !leadLastName) {
    return NextResponse.json({ error: 'lead_required', message: 'Lead traveller name is required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 400 });
  }
  if (!destinationLabel) {
    return NextResponse.json({ error: 'destination_required' }, { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json({ error: 'country_code_invalid', message: 'Country code must be 2 letters (ISO-2)' }, { status: 400 });
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
    additionalTravellers: Array.isArray(body.additionalTravellers)
      ? (body.additionalTravellers as ManualBookingInput['additionalTravellers'])
      : [],
    flights,
    hotels,
    experiences: Array.isArray(body.experiences)
      ? (body.experiences as ManualBookingInput['experiences'])
      : [],
  };

  // Control agencies carry branding on their Control record; pull it so the
  // stored booking is branded like a live one. Luna-native agencies have no
  // Control record — their branding comes from the Luna override store and is
  // applied to the booking at read time, so we just use the name/email here.
  const agencyBase: ControlAgency = { name: str(body.agencyName), email: str(body.agencyEmail) };
  const agency: ControlAgency = isControlAgency(agencyId)
    ? await loadAgencyBranding(agencyId, req.headers.get('cookie') ?? '', agencyBase)
    : agencyBase;

  // Reference: honour a supplied one, else generate.
  const supplied = str(body.reference).toUpperCase();
  let reference = supplied || genRef();

  const booking = buildManualBooking(input, agency, reference);
  if (!booking) {
    return NextResponse.json({ error: 'build_failed' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const leadName = `${leadFirstName} ${leadLastName}`.trim();
  const departureDate = booking.tripStart ? booking.tripStart.slice(0, 10) : null;
  const returnDate = booking.tripEnd ? booking.tripEnd.slice(0, 10) : null;

  // Insert the booking, retrying once on a reference collision (only when we
  // generated it — a supplied duplicate is a real conflict the admin should see).
  let inserted = false;
  for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
    booking.reference = reference;
    const { error } = await supabase.from('bookings').insert({
      agency_id: agencyId,
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
    if (!error) {
      inserted = true;
      break;
    }
    if ((error as { code?: string }).code === '23505' && !supplied && attempt === 0) {
      reference = genRef(); // collision on a generated ref — try once more
      continue;
    }
    console.error('[bookings.POST] insert failed:', error.message);
    const conflict = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      { error: conflict ? 'reference_exists' : 'insert_failed', message: conflict ? 'That booking reference already exists for this agency' : 'Could not save booking' },
      { status: conflict ? 409 : 500 },
    );
  }

  // Create a pending invite so the traveller can onboard via QR. The booking is
  // already saved, so a transient invite failure must not be swallowed (that
  // stranded the traveller with a success screen but no QR). Retry once, then —
  // if it still fails — report it honestly via `inviteError` so the UI can show
  // a warning and offer a retry instead of a misleading "scan and it appears".
  const invitePayload = {
    agency_id: agencyId,
    booking_ref: reference,
    email: leadEmail,
    departure_date: departureDate,
    return_date: returnDate,
    destination: destinationLabel,
    lead_passenger_name: leadName,
    status: 'pending',
    created_by: 'manual-booking',
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  let invite: { id: string } | null = null;
  let inviteError: string | null = null;
  for (let attempt = 0; attempt < 2 && !invite; attempt++) {
    const { data, error } = await supabase.from('invites').insert(invitePayload).select('id').single();
    if (!error && data) {
      invite = data as { id: string };
      break;
    }
    inviteError = error?.message ?? 'unknown';
    console.error(`[bookings.POST] invite insert failed (attempt ${attempt + 1}/2):`, inviteError);
  }

  // If this booking came from a PDF import, fold the admin-reviewed result into
  // the agency's learned profile (stores the final + the diff vs the raw
  // extraction). Best-effort — never let it break the save.
  const learn = body.learn as { imported?: unknown; final?: unknown; source?: unknown } | undefined;
  if (learn && learn.imported && learn.final && typeof learn.imported === 'object' && typeof learn.final === 'object') {
    try {
      await recordImportCorrection(
        agencyId,
        learn.imported as ProfileDraft,
        learn.final as ProfileDraft,
        { reference, source: typeof learn.source === 'string' ? learn.source : '' },
      );
    } catch (e) {
      console.error('[bookings.POST] profile learn failed:', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    reference,
    inviteId: invite?.id ?? null,
    inviteError: invite
      ? null
      : 'The booking was saved, but the onboarding invite could not be created. Retry it below.',
    booking: {
      destinationLabel: booking.destinationLabel,
      leadName,
      tripStart: booking.tripStart,
      tripEnd: booking.tripEnd,
      departureDate,
      flights: booking.flights.length,
      hotels: booking.hotels.length,
    },
  });
}

/**
 * POST /api/invites
 *
 * Creates a new invite. The agency calls this when they want to invite
 * a traveller. The response includes a QR-ready URL.
 *
 * Request body:
 *   {
 *     agencyId:       string  (required)
 *     bookingRef?:    string  (optional pre-fill)
 *     email?:         string  (optional pre-fill)
 *     departureDate?: string  (optional pre-fill, YYYY-MM-DD)
 *     expiresInDays?: number  (optional, defaults to 30)
 *   }
 *
 * Response (201):
 *   {
 *     inviteId:   string  (uuid)
 *     qrUrl:      string  (the URL the QR code should encode)
 *     expiresAt:  string  (ISO timestamp)
 *   }
 *
 * Errors:
 *   400 — missing/invalid input
 *   500 — server config or db error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';

// Dynamic — this route hits the database, no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateInviteBody {
  agencyId: string;
  bookingRef?: string;
  email?: string;
  departureDate?: string;
  expiresInDays?: number;
}

function isEmailLike(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function POST(req: NextRequest) {
  // Verify env is configured
  const envErr = checkSupabaseEnv();
  if (envErr) {
    return NextResponse.json({ error: `Server misconfigured: ${envErr}` }, { status: 500 });
  }

  // Parse body
  let body: CreateInviteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate agencyId
  if (!body.agencyId || typeof body.agencyId !== 'string' || body.agencyId.trim() === '') {
    return NextResponse.json({ error: 'agencyId is required' }, { status: 400 });
  }
  const agencyId = body.agencyId.trim();

  // Validate optional fields when present
  const bookingRef    = body.bookingRef?.trim() || null;
  const email         = body.email?.trim()?.toLowerCase() || null;
  const departureDate = body.departureDate?.trim() || null;

  if (email && !isEmailLike(email)) {
    return NextResponse.json({ error: 'email is not a valid email address' }, { status: 400 });
  }
  if (departureDate && !isDateLike(departureDate)) {
    return NextResponse.json({ error: 'departureDate must be YYYY-MM-DD' }, { status: 400 });
  }

  // Validate expiry
  const expiresInDays = typeof body.expiresInDays === 'number' && body.expiresInDays > 0
    ? Math.min(body.expiresInDays, 365)
    : 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  // Insert the invite
  const insertPayload = {
    agency_id: agencyId,
    booking_ref: bookingRef,
    email: email,
    departure_date: departureDate,
    expires_at: expiresAt,
    // created_by is left null for now (no agency-user auth yet)
  };

  const { data, error } = await getSupabaseAdmin()
    .from('invites')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select('id, expires_at')
    .single();

  if (error || !data) {
    console.error('[invites] insert failed', error);
    return NextResponse.json(
      { error: 'Could not create invite', detail: error?.message ?? 'unknown' },
      { status: 500 }
    );
  }

  // Type the returned row (we know its shape from the select string)
  const row = data as unknown as { id: string; expires_at: string };

  // Construct the QR URL
  // We use the request's origin so it works on luna-travel-seven.vercel.app,
  // any preview deployment, and (eventually) a custom domain.
  const origin = req.nextUrl.origin;
  const qrUrl = `${origin}/install?invite=${row.id}`;

  return NextResponse.json(
    {
      inviteId: row.id,
      qrUrl,
      expiresAt: row.expires_at,
    },
    { status: 201 }
  );
}

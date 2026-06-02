/**
 * GET /api/admin/flight-test?flight=BA852&date=2026-06-02
 *
 * Flight Hub test rig backend. Does a live AeroDataBox lookup for any flight
 * number + date and returns BOTH the normalised view (what the traveller sees)
 * and the full raw response (every field available), so we can develop and
 * debug against real data without a booking or subscription.
 *
 * Admin-gated (requireAdmin), like the other admin API routes. No DB writes,
 * no subscription registered — purely a read/explore tool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import {
  adaConfigured,
  fetchFlight,
  hasLiveFeed,
  normaliseFlight,
} from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "BA852" / "ba 852" / "BA 852A" -> { carrier:'BA', number:'852' }
function parseFlight(input: string): { carrier: string; number: string } | null {
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  const m = cleaned.match(/^([A-Z0-9]{2,3}?)(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  return { carrier: m[1], number: m[2].replace(/[A-Z]$/, '') };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (!adaConfigured()) {
    return NextResponse.json({ error: 'flight api not configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const flightIn = (url.searchParams.get('flight') || '').trim();
  const dateIn = (url.searchParams.get('date') || '').trim();

  const parsed = parseFlight(flightIn);
  if (!parsed) {
    return NextResponse.json({ error: 'invalid_flight', hint: 'e.g. BA852' }, { status: 400 });
  }
  if (!DATE_RE.test(dateIn)) {
    return NextResponse.json({ error: 'invalid_date', hint: 'YYYY-MM-DD' }, { status: 400 });
  }

  let raw: Record<string, unknown> | null;
  try {
    raw = await fetchFlight(parsed.carrier, parsed.number, dateIn);
  } catch (e) {
    return NextResponse.json({ error: 'lookup_failed', detail: (e as Error).message }, { status: 502 });
  }

  if (!raw) {
    return NextResponse.json({
      found: false,
      flight: `${parsed.carrier}${parsed.number}`,
      date: dateIn,
    });
  }

  const normalised = normaliseFlight(raw);

  // Coverage check for both airports (free tier).
  const depCoverage = await hasLiveFeed(normalised?.depAirportIcao);
  const arrCoverage = await hasLiveFeed(normalised?.arrAirportIcao);

  return NextResponse.json({
    found: true,
    flight: `${parsed.carrier}${parsed.number}`,
    date: dateIn,
    normalised,
    coverage: { departure: depCoverage, arrival: arrCoverage },
    raw, // full AeroDataBox object — every field available
  });
}

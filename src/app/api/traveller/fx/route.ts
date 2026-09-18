/**
 * GET /api/traveller/fx?to=THB[&from=GBP]
 *
 * One indicative exchange rate for the essentials screen's converter.
 *
 * Not session-gated, matching /api/traveller/place: this is public reference
 * data with nothing personal in it, and gating it would only mean a traveller
 * whose session had lapsed could not see what a coffee costs.
 *
 * It is still validated. Both codes must look like ISO 4217 before anything is
 * fetched, so the route cannot be pointed at arbitrary paths on the provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchRate } from '@/lib/fx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ISO_RE = /^[A-Z]{3}$/;

export async function GET(req: NextRequest) {
  const to = (req.nextUrl.searchParams.get('to') || '').trim().toUpperCase();
  const from = (req.nextUrl.searchParams.get('from') || 'GBP').trim().toUpperCase();

  if (!ISO_RE.test(to) || !ISO_RE.test(from)) {
    return NextResponse.json({ ok: false, error: 'invalid_currency' }, { status: 400 });
  }

  const rate = await fetchRate(from, to);
  if (!rate) {
    // 200, not an error status. "I could not get you a rate" is a normal answer
    // the screen handles by showing the one it already has; a 5xx would read to
    // the client as something being broken.
    return NextResponse.json({ ok: false, error: 'unavailable' });
  }

  return NextResponse.json({ ok: true, ...rate });
}

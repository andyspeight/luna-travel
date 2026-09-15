/**
 * GET /api/routes/lookup?from=CLJ&to=AGP&carrier=wizz&month=2
 *
 * The read side of the route database, for Luna Chat.
 *
 * Luna Chat lives in another project and has no AeroDataBox key, which is the
 * right way round: the key stays in one place and one project owns the sweep.
 * Server to server only, authenticated with TG_INTERNAL_KEY, same as the
 * traveller booking route.
 *
 * WHAT IT WILL AND WILL NOT SAY. A hit returns confirmed:true with the airlines
 * and the months we have seen it fly. Anything else returns confirmed:false and
 * NOTHING ELSE — no reason, no coverage flag, no "we swept this airport and saw
 * nothing". A caller cannot distinguish a route that does not exist from one we
 * have never looked for, because neither can we, and a shape that pretended
 * otherwise would be an invitation to write "there is no direct flight". That
 * sentence is what started this whole piece of work.
 *
 * So: Luna may say "yes, that is flown direct". Luna may never say the reverse.
 * On confirmed:false it should add nothing to the prompt at all and let the
 * existing honesty rules handle the turn.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/constant-time';
import { lookupRoute } from '@/lib/route-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IATA_RE = /^[A-Z0-9]{3}$/;

export async function GET(req: NextRequest) {
  const key = process.env.TG_INTERNAL_KEY;
  const supplied = req.headers.get('x-tg-internal-key') || '';
  if (!key || !safeEqual(supplied, key)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = (url.searchParams.get('from') || '').trim().toUpperCase();
  const to = (url.searchParams.get('to') || '').trim().toUpperCase();
  const carrier = (url.searchParams.get('carrier') || '').trim();
  const monthRaw = (url.searchParams.get('month') || '').trim();

  // A malformed request is a bad request, never a confirmed:false. Answering
  // "no" to a typo is the same failure as answering "no" to a real route.
  if (!IATA_RE.test(from) || !IATA_RE.test(to)) {
    return NextResponse.json({ error: 'invalid_airport', hint: 'from and to must be IATA codes' }, { status: 400 });
  }
  let month: number | undefined;
  if (monthRaw) {
    const n = Number(monthRaw);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return NextResponse.json({ error: 'invalid_month', hint: '1-12' }, { status: 400 });
    }
    month = n;
  }

  const answer = await lookupRoute(from, to, { carrier: carrier || undefined, month });

  // Cacheable for an hour. The underlying data only moves once a week, and a
  // chat turn should never wait on a database round trip it could have skipped.
  return NextResponse.json(answer, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}

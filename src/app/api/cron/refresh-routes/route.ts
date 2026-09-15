/**
 * GET /api/cron/refresh-routes — the weekly route sweep (Vercel Cron).
 *
 * Asks AeroDataBox what flew out of each of our departure airports, and merges
 * the answer into luna_travel.route_observations. Run every week and never
 * discarded, this accumulates the route database nobody sells us: which routes
 * run, who flies them, and in which months.
 *
 * WHY WEEKLY AND NOT DAILY. The provider's window is the seven days before the
 * call, so weekly gives complete coverage with no gaps. Daily would re-read the
 * same overlapping week seven times for seven times the cost.
 *
 * COST. One Tier 3 call per airport, 42 airports, so about 42 calls a week and
 * 180 a month for Great Britain, Ireland and Romania together.
 *
 * Deliberately NOT under /api/admin, so the edge middleware (which wants a
 * tg_session) does not block the cron. Gated by CRON_SECRET, same as
 * /api/cron/sync.
 *
 * ?date=YYYY-MM-DD asks about the seven days before that date instead of now,
 * which is how the one-off backfill walks back through past months. ?market=RO
 * limits the sweep. Both are for operators, and both still need the secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/constant-time';
import { MARKET_ORIGINS, sweepOrigins } from '@/lib/route-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The sweep is sequential and deliberately unhurried. 42 airports at roughly a
// second each needs more than the default function ceiling.
export const maxDuration = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = (url.searchParams.get('date') || '').trim();
  const market = (url.searchParams.get('market') || '').trim().toUpperCase();

  if (date && !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'invalid_date', hint: 'YYYY-MM-DD' }, { status: 400 });
  }
  // A future date would ask the provider about a week that has not happened.
  if (date && date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'future_date', hint: 'the window is the seven days BEFORE this date' }, { status: 400 });
  }

  const origins = market
    ? MARKET_ORIGINS.filter((o) => o.market === market)
    : MARKET_ORIGINS;

  if (!origins.length) {
    return NextResponse.json({ error: 'unknown_market', hint: 'GB, IE or RO' }, { status: 400 });
  }

  const summary = await sweepOrigins(origins, date || undefined);

  // A sweep that reached nothing is worth shouting about in the logs: it is
  // either the key, the plan, or the vendor, and none of those fix themselves.
  if (summary.failures.length === origins.length) {
    console.error('[cron.refresh-routes] every airport failed', summary.failures.slice(0, 3));
  } else if (summary.failures.length) {
    console.warn(`[cron.refresh-routes] ${summary.failures.length}/${origins.length} airports failed`);
  }

  return NextResponse.json({ ok: true, ...summary });
}

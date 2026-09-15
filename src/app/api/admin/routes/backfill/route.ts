/**
 * POST /api/admin/routes/backfill  { date: "2026-08-15", market?: "RO" }
 *
 * Sweeps ONE past window into the route database. Admin-gated, same pattern as
 * the "Run sync now" button.
 *
 * ONE WINDOW PER REQUEST, DELIBERATELY. A year across all 42 airports is 504
 * billed calls and the best part of ten minutes, which no serverless function
 * survives. The caller walks the windows itself, one request each, so a run
 * that is interrupted has still banked everything it finished — and since
 * backfillWindows() is stable, re-running simply overwrites the same windows
 * rather than making new ones.
 *
 * GET returns the windows that WOULD be swept and what they would cost, so the
 * number of billed calls is visible before anything is spent rather than after.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { adaConfigured } from '@/lib/aerodatabox';
import { MARKET_ORIGINS, backfillWindows, sweepOrigins } from '@/lib/route-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONTHS = 24;

function originsFor(market: string) {
  return market ? MARKET_ORIGINS.filter((o) => o.market === market) : MARKET_ORIGINS;
}

/** What a backfill would do, and cost, without doing any of it. */
export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const market = (url.searchParams.get('market') || '').trim().toUpperCase();
  const months = Math.min(Math.max(parseInt(url.searchParams.get('months') || '12', 10) || 12, 1), MAX_MONTHS);
  const origins = originsFor(market);
  const windows = backfillWindows(months, new Date());

  return NextResponse.json({
    configured: adaConfigured(),
    market: market || 'ALL',
    months,
    airports: origins.length,
    windows,
    // Each origin in each window is one Tier 3 routes call. The free feed check
    // that runs alongside it is not billed.
    billedCalls: origins.length * windows.length,
  });
}

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (!adaConfigured()) {
    return NextResponse.json({ error: 'flight api not configured' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { date?: string; market?: string };
  const date = (body.date || '').trim();
  const market = (body.market || '').trim().toUpperCase();

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'invalid_date', hint: 'YYYY-MM-DD' }, { status: 400 });
  }
  // The window is the seven days BEFORE the date, so a future date asks about a
  // week that has not happened.
  if (date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'future_date' }, { status: 400 });
  }

  const origins = originsFor(market);
  if (!origins.length) {
    return NextResponse.json({ error: 'unknown_market', hint: 'GB, IE or RO' }, { status: 400 });
  }

  const summary = await sweepOrigins(origins, date);

  // A plan that will not look this far back is the expected failure here, and
  // it is worth naming rather than leaving as a pile of 4xx counts.
  const planLimited = summary.failures.filter((f) => f.error === 'plan_does_not_include_routes').length;
  return NextResponse.json({
    ok: true,
    planLimited: planLimited === origins.length ? 'all' : planLimited ? 'some' : 'none',
    ...summary,
  });
}

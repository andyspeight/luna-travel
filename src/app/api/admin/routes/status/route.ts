/**
 * GET /api/admin/routes/status — what the route database actually holds.
 *
 * Counts, coverage and which calendar months we have banked. Admin-gated.
 *
 * This is the operator's view, and it is deliberately NOT the view Luna gets.
 * The per-airport route_count and covered flag here are sweep diagnostics: they
 * say whether our own job worked, not whether a route exists. Luna reads
 * /api/routes/lookup instead, which can only ever confirm.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { adaConfigured } from '@/lib/aerodatabox';
import { airportStatus, routeStats } from '@/lib/route-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const iata = (url.searchParams.get('airport') || '').trim();

  const [stats, airports] = await Promise.all([routeStats(), airportStatus(iata || undefined)]);

  return NextResponse.json({
    configured: adaConfigured(),
    ...stats,
    monthNames: stats.monthsCovered.map((m) => MONTH_NAMES[m - 1]),
    // Twelve months banked is the point at which a July question about a
    // February route can be answered, so it is worth showing the distance.
    monthsRemaining: 12 - stats.monthsCovered.length,
    airportDetail: airports.airports,
  });
}

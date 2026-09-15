/**
 * GET /api/admin/flight-routes?from=CLJ&to=AGP&carrier=wizz
 *
 * "Does anyone fly A to B non-stop, and is it who the visitor said?"
 *
 * The question Luna Chat got wrong: a Romanian customer was told Wizz Air
 * probably flew Cluj to Malaga with a connection. Wizz fly it direct. Luna has
 * no schedule data and guessed. We already hold an AeroDataBox key for live
 * flight status in this app, so this rig answers whether that same key can also
 * answer the pre-booking question — before anyone buys a second subscription.
 *
 * Three steps, cheapest first, and it stops as soon as the answer is settled:
 *   1. Free-tier feed check on the origin. No schedules feed means the routes
 *      endpoint is empty for that airport and no plan upgrade changes it.
 *   2. One TIER 3 routes call. Costs more than a single API unit, so this route
 *      is admin-gated and is never called from a traveller or visitor path.
 *   3. A control check that other destinations came back, which separates "this
 *      route did not fly this week" from "this airport is not covered at all".
 *
 * Read-only. No DB writes, no subscriptions, no credit spend beyond the lookup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import {
  adaConfigured,
  airportFeeds,
  airportRoutes,
  findRoute,
  operatedBy,
} from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IATA_RE = /^[A-Z0-9]{3}$/;
const ICAO_RE = /^[A-Z]{4}$/;

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (!adaConfigured()) {
    return NextResponse.json({ error: 'flight api not configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const from = (url.searchParams.get('from') || '').trim().toUpperCase();
  const to = (url.searchParams.get('to') || '').trim().toUpperCase();
  const carrier = (url.searchParams.get('carrier') || '').trim();
  const originIcao = (url.searchParams.get('icao') || '').trim().toUpperCase();

  if (!IATA_RE.test(from)) {
    return NextResponse.json({ error: 'invalid_from', hint: 'IATA, e.g. CLJ' }, { status: 400 });
  }
  if (to && !IATA_RE.test(to)) {
    return NextResponse.json({ error: 'invalid_to', hint: 'IATA, e.g. AGP' }, { status: 400 });
  }
  if (originIcao && !ICAO_RE.test(originIcao)) {
    return NextResponse.json({ error: 'invalid_icao', hint: 'ICAO, e.g. LRCL' }, { status: 400 });
  }

  // ── 1. coverage, free ──
  const feeds = originIcao ? await airportFeeds(originIcao) : null;

  // ── 2. the routes call, billed ──
  let result: Awaited<ReturnType<typeof airportRoutes>>;
  try {
    result = await airportRoutes(from);
  } catch (e) {
    return NextResponse.json(
      { error: 'lookup_failed', detail: (e as Error).message, feeds },
      { status: 502 },
    );
  }

  if (result.routes === null) {
    // 403 is a plan limit, not a data answer. Say which, because the fix differs.
    const planLimited = result.status === 401 || result.status === 403;
    return NextResponse.json(
      {
        ok: false,
        reason: planLimited ? 'plan_does_not_include_routes' : 'lookup_error',
        status: result.status,
        hint: planLimited
          ? 'The key works, but this plan does not include the Tier 3 routes endpoint. That is a billing question, not a coverage one.'
          : 'AeroDataBox returned an error for this airport.',
        feeds,
      },
      { status: 200 },
    );
  }

  const routes = result.routes;
  const match = to ? findRoute(routes, to) : null;
  const carrierMatch = match && carrier ? operatedBy(match, carrier) : null;

  // ── 3. the control ──
  // An empty list from a covered airport is a different animal from an empty
  // list because the airport is invisible. Say which one this is.
  const busiest = [...routes]
    .sort((a, b) => (b.averageDailyFlights ?? 0) - (a.averageDailyFlights ?? 0))
    .slice(0, 8)
    .map((r) => ({
      iata: r.iata,
      name: r.municipality || r.name,
      perDay: r.averageDailyFlights,
      operators: r.operators.map((o) => o.name).filter(Boolean),
    }));

  return NextResponse.json({
    ok: true,
    from,
    to: to || null,
    carrier: carrier || null,
    feeds,
    routeCount: routes.length,
    airportCovered: routes.length > 0,
    // The answer, and ONLY in the positive direction. found:false means "not in
    // the last seven days", never "no such route" — the window is seven days and
    // a seasonal or twice-weekly service can sit outside it.
    found: !!match,
    match: match
      ? {
          iata: match.iata,
          name: match.municipality || match.name,
          countryCode: match.countryCode,
          averageDailyFlights: match.averageDailyFlights,
          operators: match.operators,
          carrierMatch,
        }
      : null,
    verdict: verdictFor({ routes: routes.length, match: !!match, carrierMatch, to, carrier }),
    busiest,
  });
}

function verdictFor(o: {
  routes: number;
  match: boolean;
  carrierMatch: boolean | null;
  to: string;
  carrier: string;
}): string {
  if (!o.routes) {
    return 'No routes at all for this airport. Either it has no schedules feed or it is not in their database. Check the feeds block above before concluding anything.';
  }
  if (!o.to) {
    return `${o.routes} destinations flown non-stop from here in the last seven days. Add a destination to ask about a specific pair.`;
  }
  if (!o.match) {
    return `${o.to} did not appear in the last seven days, out of ${o.routes} destinations that did. That means NOT THIS WEEK, not "no such route" — a seasonal or twice-weekly service falls outside the window. Luna must stay silent on it, never deny it.`;
  }
  if (o.carrier && o.carrierMatch === false) {
    return `${o.to} is flown non-stop, but not by anyone matching "${o.carrier}" this week. Check the operators list: the same brand flies under several AOCs and the other one may have operated.`;
  }
  if (o.carrier && o.carrierMatch) {
    return `Yes. ${o.to} is flown non-stop and "${o.carrier}" is among the operators. This is the answer Luna could not give.`;
  }
  return `${o.to} is flown non-stop from here. Operators are listed above.`;
}

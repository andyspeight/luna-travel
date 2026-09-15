/**
 * GET /api/admin/flight-routes?from=CLJ&to=AGP&carrier=wizz&icao=LRCL
 * GET /api/admin/flight-routes?from=CLJ,LTN,MAN,OTP        (sweep)
 *
 * "Can AeroDataBox tell us who flies A to B non-stop, and what does the data
 * actually look like?"
 *
 * The question Luna Chat got wrong: a Romanian customer was told Wizz Air
 * probably flew Cluj to Malaga with a connection. Wizz fly it direct. Luna has
 * no schedule data and guessed. We already hold an AeroDataBox key in this app
 * for live flight status, so this rig establishes whether that same key answers
 * the pre-booking question — before anyone buys a second subscription.
 *
 * Cheapest first, and it stops as soon as the answer is settled:
 *   1. Free-tier feed check per origin. No schedules feed means the routes
 *      endpoint is empty for that airport and no plan upgrade changes it.
 *   2. One TIER 3 routes call per origin. Costs more than a single API unit, so
 *      this is admin-gated and never runs on a traveller or visitor path.
 *   3. A control: what else came back, which separates "this route did not fly
 *      this week" from "this airport is not covered at all".
 *
 * Returns the RAW payload as well as our reading of it, because the point of a
 * test rig is to show what the provider actually sends, not what we think it
 * sends. Read-only: no DB writes, no subscriptions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import {
  adaConfigured,
  airportFeeds,
  airportRoutes,
  findRoute,
  operatedBy,
  operatorInventory,
  type RouteRecord,
} from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IATA_RE = /^[A-Z0-9]{3}$/;
const ICAO_RE = /^[A-Z]{4}$/;

// A sweep is one billed Tier 3 call per airport. Capped so a stray comma in the
// box cannot quietly spend the month's units.
const MAX_ORIGINS = 6;

interface OriginResult {
  from: string;
  icao: string | null;
  feeds: Awaited<ReturnType<typeof airportFeeds>>;
  status: number;
  ok: boolean;
  reason: string | null;
  routeCount: number;
  found: boolean | null;
  match: {
    iata: string | null;
    name: string | null;
    countryCode: string | null;
    averageDailyFlights: number | null;
    operators: { name: string | null; iata: string | null; icao: string | null }[];
    carrierMatch: boolean | null;
  } | null;
  destinations: { iata: string | null; name: string | null; perDay: number | null; operators: string[] }[];
  operators: { name: string; codes: string[]; routes: number }[];
  verdict: string;
}

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (!adaConfigured()) {
    return NextResponse.json({ error: 'flight api not configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const fromIn = (url.searchParams.get('from') || '').trim().toUpperCase();
  const to = (url.searchParams.get('to') || '').trim().toUpperCase();
  const carrier = (url.searchParams.get('carrier') || '').trim();
  const icaoIn = (url.searchParams.get('icao') || '').trim().toUpperCase();
  const wantRaw = url.searchParams.get('raw') === '1';

  const origins = [...new Set(fromIn.split(/[,\s]+/).filter(Boolean))];
  if (!origins.length || origins.some((o) => !IATA_RE.test(o))) {
    return NextResponse.json({ error: 'invalid_from', hint: 'IATA, e.g. CLJ or CLJ,LTN,MAN' }, { status: 400 });
  }
  if (origins.length > MAX_ORIGINS) {
    return NextResponse.json(
      { error: 'too_many_origins', hint: `${MAX_ORIGINS} at most — each one is a billed Tier 3 call.` },
      { status: 400 },
    );
  }
  if (to && !IATA_RE.test(to)) {
    return NextResponse.json({ error: 'invalid_to', hint: 'IATA, e.g. AGP' }, { status: 400 });
  }
  const icaos = icaoIn.split(/[,\s]+/).filter(Boolean);
  if (icaos.some((c) => !ICAO_RE.test(c))) {
    return NextResponse.json({ error: 'invalid_icao', hint: 'ICAO, e.g. LRCL' }, { status: 400 });
  }

  const results: OriginResult[] = [];
  const raws: Record<string, unknown> = {};
  let billedCalls = 0;

  for (let i = 0; i < origins.length; i++) {
    const from = origins[i];
    // One ICAO given with one origin pairs up; otherwise coverage is skipped
    // rather than guessed, because an ICAO cannot be derived from an IATA code.
    const icao = icaos.length === origins.length ? icaos[i] : origins.length === 1 ? icaos[0] ?? null : null;

    const feeds = icao ? await airportFeeds(icao) : null;

    let res: Awaited<ReturnType<typeof airportRoutes>>;
    try {
      res = await airportRoutes(from);
      billedCalls += 1;
    } catch (e) {
      results.push(blank(from, icao, feeds, 0, 'lookup_failed', (e as Error).message));
      continue;
    }

    if (wantRaw) raws[from] = res.raw;

    if (res.routes === null) {
      const planLimited = res.status === 401 || res.status === 403;
      results.push(
        blank(
          from,
          icao,
          feeds,
          res.status,
          planLimited ? 'plan_does_not_include_routes' : 'lookup_error',
          planLimited
            ? 'The key works, but this plan does not include the Tier 3 routes endpoint. That is a billing question, not a coverage one.'
            : `AeroDataBox returned ${res.status} for this airport.`,
        ),
      );
      continue;
    }

    const routes = res.routes;
    const match = to ? findRoute(routes, to) : null;
    const carrierMatch = match && carrier ? operatedBy(match, carrier) : null;

    results.push({
      from,
      icao,
      feeds,
      status: res.status,
      ok: true,
      reason: null,
      routeCount: routes.length,
      found: to ? !!match : null,
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
      destinations: topDestinations(routes),
      operators: operatorInventory(routes).slice(0, 15),
      verdict: verdictFor({ from, routes: routes.length, match: !!match, carrierMatch, to, carrier }),
    });
  }

  return NextResponse.json({
    ok: results.some((r) => r.ok),
    to: to || null,
    carrier: carrier || null,
    billedCalls,
    costNote: `${billedCalls} Tier 3 call${billedCalls === 1 ? '' : 's'} made. Tier 3 costs more than one API unit each.`,
    results,
    ...(wantRaw ? { raw: raws } : {}),
  });
}

function blank(
  from: string,
  icao: string | null,
  feeds: OriginResult['feeds'],
  status: number,
  reason: string,
  verdict: string,
): OriginResult {
  return {
    from, icao, feeds, status, ok: false, reason,
    routeCount: 0, found: null, match: null, destinations: [], operators: [], verdict,
  };
}

function topDestinations(routes: RouteRecord[]) {
  return [...routes]
    .sort((a, b) => (b.averageDailyFlights ?? 0) - (a.averageDailyFlights ?? 0))
    .slice(0, 12)
    .map((r) => ({
      iata: r.iata,
      name: r.municipality || r.name,
      perDay: r.averageDailyFlights,
      operators: r.operators.map((o) => o.name).filter(Boolean) as string[],
    }));
}

function verdictFor(o: {
  from: string;
  routes: number;
  match: boolean;
  carrierMatch: boolean | null;
  to: string;
  carrier: string;
}): string {
  if (!o.routes) {
    return `No routes at all for ${o.from}. Either it has no schedules feed or it is not in their database. Check the feeds block before concluding anything.`;
  }
  if (!o.to) {
    return `${o.routes} destinations flown non-stop from ${o.from} in the last seven days.`;
  }
  if (!o.match) {
    return `${o.to} did not appear from ${o.from} in the last seven days, out of ${o.routes} destinations that did. That means NOT THIS WEEK, not "no such route" — a seasonal or twice-weekly service falls outside the window. Luna must stay silent on it, never deny it.`;
  }
  if (o.carrier && o.carrierMatch === false) {
    return `${o.to} is flown non-stop from ${o.from}, but not by anyone matching "${o.carrier}" this week. Check the operators list: the same brand flies under several AOCs and the other one may have operated.`;
  }
  if (o.carrier && o.carrierMatch) {
    return `Yes. ${o.from} to ${o.to} is flown non-stop and "${o.carrier}" is among the operators. This is the answer Luna could not give.`;
  }
  return `${o.from} to ${o.to} is flown non-stop. Operators are listed above.`;
}

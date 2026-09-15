/**
 * GET /api/traveller/park?cc=US&slug=walt-disney-world-resort
 *
 * Returns one theme park guide from the Travelgenix content base for the
 * park deep route.
 *
 * Public, traveller-facing — like /api/traveller/destination it only ever
 * returns published destination knowledge (Status gated to Live or Published,
 * since every Orlando park row is 'Published'), carries no PII, and is not
 * gated. It takes no booking reference, no traveller name and no dates, so the
 * response is identical for every traveller and can be held at the edge;
 * matching a park to a traveller's actual tickets happens on the client.
 *
 * When AIRTABLE_KEY isn't configured it returns { configured: false } so the
 * park panel hides itself rather than erroring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { destinationContentConfigured, getPark } from '@/lib/destination-content';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_HIT = 'public, s-maxage=900, stale-while-revalidate=86400';

/** force-dynamic defaults responses to no-store, so the cacheable case has to
 *  set its header explicitly or the CDN never holds a copy. */
function ok(body: unknown, cache: string) {
  return NextResponse.json(body, { headers: { 'Cache-Control': cache } });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const cc = (params.get('cc') || '').trim();
  if (!/^[A-Za-z]{2}$/.test(cc)) {
    return NextResponse.json(
      { error: 'invalid_cc' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const slug = (params.get('slug') || '').trim();
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
    return NextResponse.json(
      { error: 'invalid_slug' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!destinationContentConfigured()) {
    return ok({ configured: false, reason: 'not_configured', park: null }, 'no-store');
  }

  try {
    const park = await getPark(cc, slug);
    if (!park) {
      // Stable prefix: a run of these is how a stale generated index shows up.
      console.info('[park] unresolved', { cc, slug });
      return ok({ configured: false, reason: 'unknown_place', park: null }, 'no-store');
    }
    return ok({ configured: true, park }, CACHE_HIT);
  } catch (err) {
    console.error('[traveller/park]', (err as Error).message);
    return NextResponse.json(
      { configured: false, reason: 'content_unavailable', park: null },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

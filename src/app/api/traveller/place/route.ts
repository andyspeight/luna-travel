/**
 * GET /api/traveller/place?cc=US&slug=florida&q=lake%20buena%20vista&lat=28.38&lng=-81.52
 *
 * Returns the merged Travelgenix destination content for a booking's place:
 * the resort/city/country chain flattened into one PlaceView, with prose
 * stacked by tier, facts collapsed to the most specific tier, and every event
 * and climate value unfiltered.
 *
 * Public, traveller-facing — like /api/traveller/destination it only ever
 * returns published destination knowledge (Status gated to Live), carries no
 * PII, and is not gated. It deliberately takes NO booking reference, NO
 * traveller name and NO dates: the response is then byte-identical for every
 * traveller in the same place, which is what makes it CDN-cacheable. Event
 * windowing and ticket matching happen on the client over the whole payload.
 *
 * The optional lat/lng are the ATTRACTION's or HOTEL's published location as the
 * supplier sent it, not the traveller's — no device location is involved and
 * nothing here identifies a person. They are rounded to 2dp so that everyone on
 * the same ticket shares one cache entry, and they exist because supplier feeds
 * send postal cities ('Lake Buena Vista', 'Kissimmee') that match no place name.
 *
 * When AIRTABLE_KEY isn't configured (e.g. local dev) it returns
 * { configured: false } so every surface hides its own block rather than
 * erroring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { destinationContentConfigured, getPlaceView } from '@/lib/destination-content';
import { resolvePlaceRef, type PlaceCoords } from '@/lib/place-index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_HIT = 'public, s-maxage=900, stale-while-revalidate=86400';

/**
 * Coordinates are rounded to 2dp (~1.1 km) before anything is done with them.
 *
 * This response is CDN-cached by URL, so raw supplier precision would give every
 * ticket its own cache entry for no benefit whatsoever: the resolver works at a
 * scale of tens of kilometres (COORD_RESOLVE_KM is 50), so a metre of difference
 * can never change which place row wins. Rounding here as well as in the client
 * hook means a hand-built URL resolves to exactly what its cache key implies.
 */
const COORD_DP = 100;

/** A finite, in-range, non-Null-Island pair, or undefined. Null Island (0,0) is
 *  what a supplier feed sends when it has no coordinates at all. */
function readCoords(latRaw: string | null, lngRaw: string | null): PlaceCoords | undefined {
  if (latRaw === null || lngRaw === null) return undefined;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  return { lat: Math.round(lat * COORD_DP) / COORD_DP, lng: Math.round(lng * COORD_DP) / COORD_DP };
}

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

  const rawSlug = (params.get('slug') || '').trim();
  const slug = /^[a-z0-9-]{2,60}$/.test(rawSlug) ? rawSlug : undefined;

  const signals = params
    .getAll('q')
    .map((q) => q.trim())
    .filter((q) => q.length >= 3 && q.length <= 60)
    .slice(0, 3);

  const coords = readCoords(params.get('lat'), params.get('lng'));

  // Coordinate resolution happens HERE, not inside the content adapter, because
  // getPlaceView composes from cc + slug + signals and place-index is pure and
  // synchronous — so we run the resolver ourselves (an array scan, no network,
  // microseconds) and hand the winning row down as the explicit slug. A supplier
  // that sends 'Lake Buena Vista' or 'Kissimmee' matches no name, but its ticket
  // coordinates land on the Orlando row, and that is the slug the adapter then
  // reads. An invalid or absent pair leaves the request byte-identical to before.
  let effectiveSlug = slug;
  if (coords) {
    const ref = resolvePlaceRef({ countryCode: cc, locationSlug: slug, signals, coords });
    // Only an upgrade: a country-tier ref is what we already fall back to, so
    // writing it into the slug would add nothing and could only confuse the log.
    if (ref && ref.tier !== 'country' && ref.slug) effectiveSlug = ref.slug;
  }

  if (!destinationContentConfigured()) {
    return ok({ configured: false, reason: 'not_configured', place: null }, 'no-store');
  }

  try {
    const place = await getPlaceView({ countryCode: cc, locationSlug: effectiveSlug, signals });
    if (!place) {
      // Stable prefix: a run of these is how a stale generated index shows up.
      console.info('[place] unresolved', { cc, slug: effectiveSlug, signals, coords });
      return ok({ configured: false, reason: 'unknown_place', place: null }, 'no-store');
    }
    return ok({ configured: true, place }, CACHE_HIT);
  } catch (err) {
    console.error('[traveller/place]', (err as Error).message);
    return NextResponse.json(
      { configured: false, reason: 'content_unavailable', place: null },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

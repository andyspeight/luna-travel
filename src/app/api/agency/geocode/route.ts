/**
 * GET /api/agency/geocode?q=… — place search for the Trip pages editor.
 *
 * Thin server-side proxy over OpenStreetMap Nominatim so the browser never
 * talks to a third party directly and the query is validated first. Agency
 * session required (this is an authoring tool, not a public geocoder).
 *
 * Nominatim usage policy: low volume, proper User-Agent identifying the app,
 * results cached briefly. Failures return an empty result set with an error
 * flag — the editor falls back to manual coordinates, never a dead end.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'LunaTravel/1.0 (+https://lunatravel.travelify.io)';

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 200) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const url = `${NOMINATIM}?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
      // Same query twice in a session shouldn't hit Nominatim twice.
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const results = (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        name: typeof r.display_name === 'string' ? r.display_name : '',
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .slice(0, 6);
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[agency.geocode]', e instanceof Error ? e.message : e);
    return NextResponse.json({ results: [], error: 'geocode_failed' });
  }
}

/**
 * GET /api/app/manifest — the web app manifest for an agency's app: its name
 * under the icon, its colours and its icons.
 *
 * The traveller app points the page at this once it knows whose trip it is
 * (components/app-identity), so what Android installs is the agency's app
 * rather than "Luna Travel". Like the icons, it is drawn entirely from its URL
 * and every value is re-checked here.
 */

import { NextResponse } from 'next/server';
import { parseIconQuery, buildManifest } from '@/lib/app-icon';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const q = parseIconQuery(new URL(req.url).searchParams);
  if (!q || q.size !== null) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  return new NextResponse(JSON.stringify(buildManifest(q.spec, q.name)), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

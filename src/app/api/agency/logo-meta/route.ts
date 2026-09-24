/**
 * POST /api/agency/logo-meta — measure a logo the agency has just uploaded,
 * so the App branding previews show it the way travellers will see it before
 * Save is pressed (lib/logo-look). Body: { url }.
 *
 * Only a logo in the signed-in agency's own folder of our Blob store. Save
 * measures it again anyway, so nothing here is trusted later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';
import { analyzeLogo, isStoredLogoUrl } from '@/lib/logo-analyze';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let url = '';
  try {
    url = String(((await req.json()) as { url?: unknown })?.url ?? '');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isStoredLogoUrl(url) || !new URL(url).pathname.startsWith(`/agency-logos/${claims.agencyId}-`)) {
    return NextResponse.json({ error: 'not_your_logo' }, { status: 400 });
  }
  return NextResponse.json({ meta: await analyzeLogo(url) });
}

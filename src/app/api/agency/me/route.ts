/**
 * GET /api/agency/me — the signed-in agency + its current branding override.
 * 401 if there is no valid lt_agency_session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';
import { getLunaAgency } from '@/lib/agencies';
import { getBrandingOverride } from '@/lib/agency-branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const agency = await getLunaAgency(claims.agencyId);
  if (!agency) {
    return NextResponse.json({ error: 'agency_not_found' }, { status: 404 });
  }

  const branding = await getBrandingOverride(claims.agencyId);

  return NextResponse.json({
    ok: true,
    agency: {
      id: agency.id,
      name: agency.trading_name || agency.name,
      legalName: agency.name,
      contactEmail: agency.contact_email,
      email: claims.email,
    },
    branding,
  });
}

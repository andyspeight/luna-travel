/**
 * GET /api/agency/me — the signed-in agency, its branding override and its
 * operational settings. The portal loads this on every page, so it is also how
 * the settings form pre-fills.
 * 401 if there is no valid lt_agency_session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';
import { getBrandingOverride } from '@/lib/agency-branding';
import { getAgencySettings } from '@/lib/agency-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const agency = await resolvePortalAgency(claims);
  if (!agency) {
    return NextResponse.json({ error: 'agency_not_found' }, { status: 404 });
  }

  const [branding, settings] = await Promise.all([
    getBrandingOverride(claims.agencyId),
    getAgencySettings(claims.agencyId),
  ]);

  return NextResponse.json({
    ok: true,
    agency: {
      id: agency.id,
      name: agency.name,
      legalName: agency.legalName,
      contactEmail: agency.email || null,
      email: claims.email,
    },
    branding,
    settings,
  });
}

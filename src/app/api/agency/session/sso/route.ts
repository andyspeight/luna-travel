/**
 * POST /api/agency/session/sso — open access for a Control agency.
 *
 * A Control agent arriving from their Travelgenix Control dashboard already
 * carries the central tg_session cookie (it is scoped to .travelify.io, so it
 * reaches lunatravel.travelify.io on this same-origin call). We exchange it for
 * an agency portal session — no magic link: validate via Control, then mint the
 * lt_agency_session cookie scoped to their client (agency).
 *
 * 401 when there is no eligible Control session (not signed in, no client, the
 * client is suspended, or it is not entitled to Luna Travel). The portal treats
 * that as "sign in from your Control dashboard".
 *
 * Not under /api/admin or /api/invites, so no SSO middleware runs here — the
 * tg_session itself is the credential, validated against Control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeControlSession } from '@/lib/agency-sso';
import {
  signAgencySession,
  AGENCY_COOKIE_NAME,
  AGENCY_COOKIE_MAX_AGE,
} from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const identity = await exchangeControlSession(req.headers.get('cookie'));
  if (!identity) {
    return NextResponse.json({ error: 'no_control_session' }, { status: 401 });
  }

  const jwt = await signAgencySession({
    agencyId: identity.agencyId,
    email: identity.email,
    source: 'control',
    agencyName: identity.agencyName,
  });

  const res = NextResponse.json({
    ok: true,
    agency: { id: identity.agencyId, name: identity.agencyName },
  });
  res.cookies.set(AGENCY_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AGENCY_COOKIE_MAX_AGE,
  });
  return res;
}

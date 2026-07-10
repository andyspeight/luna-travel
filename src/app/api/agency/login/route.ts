/**
 * POST /api/agency/login — exchange a magic-link token for an agency session.
 *
 * Body: { token: string }. On success sets the lt_agency_session cookie and
 * returns the agency. This is the ONLY way to obtain an agency session; there
 * is no password. Not under /api/admin or /api/invites, so no SSO middleware —
 * the token itself is the credential.
 */

import { NextRequest, NextResponse } from 'next/server';
import { peekLoginToken, consumeLoginToken } from '@/lib/agency-login';
import { getLunaAgency } from '@/lib/agencies';
import {
  signAgencySession,
  AGENCY_COOKIE_NAME,
  AGENCY_COOKIE_MAX_AGE,
} from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  // Validate the token and confirm the agency still exists BEFORE burning it, so
  // a transient lookup error can't kill a valid one-time link (the token is only
  // spent once we're actually committing the login).
  const peeked = await peekLoginToken(token);
  if (!peeked) {
    // Unknown, already used, or expired — all indistinguishable to the caller.
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
  }

  const agency = await getLunaAgency(peeked.agencyId);
  if (!agency) {
    // Agency removed (or its lookup errored) — leave the token unspent so a
    // retry can still work once the transient condition clears.
    return NextResponse.json({ error: 'agency_not_found' }, { status: 404 });
  }

  // Spend the token now (atomic single-use). If it lost a race to a concurrent
  // login, treat it as already used.
  const consumed = await consumeLoginToken(token);
  if (!consumed) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
  }

  const jwt = await signAgencySession({ agencyId: agency.id, email: consumed.email });

  const res = NextResponse.json({
    ok: true,
    agency: { id: agency.id, name: agency.trading_name || agency.name },
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

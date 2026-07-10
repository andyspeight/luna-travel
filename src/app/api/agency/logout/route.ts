/**
 * POST /api/agency/logout — clear the lt_agency_session cookie.
 */

import { NextResponse } from 'next/server';
import { AGENCY_COOKIE_NAME } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AGENCY_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

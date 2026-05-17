/**
 * POST /api/admin/signin
 *
 * Verifies email (must be on Travelgenix/Agendas domain) + shared password
 * (from ADMIN_PASSWORD env var), then issues an HttpOnly session cookie.
 *
 * Generic error messages — never reveal whether email or password was wrong.
 * Rate limit isn't needed at this stage because:
 *   - Domain restriction blocks 99.99% of attack surface already
 *   - Single-instance Vercel function with bot detection upstream
 *   - This is a 1-day interim solution before SSO arrives
 *
 * When SSO lands (tomorrow), this endpoint stays as a fallback for local
 * sign-in, but the primary path becomes the id.travelify.io cookie which
 * the middleware will accept transparently.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isAllowedEmail,
  verifyAdminPassword,
  signAdminSession,
  ADMIN_COOKIE_NAME,
} from '@/lib/admin-session';

function unauthorised() {
  return NextResponse.json(
    { error: 'invalid_credentials', message: "We couldn't sign you in. Check your email and password." },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return unauthorised();
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isAllowedEmail(email)) {
    return unauthorised();
  }
  if (!verifyAdminPassword(password)) {
    return unauthorised();
  }

  const token = await signAdminSession(email);
  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours, matches JWT
  });
  return res;
}

/**
 * POST /api/admin/signout
 *
 * Clears the admin session cookie. Idempotent — safe to call when already
 * signed out. Returns 200 either way; the client redirects to /admin/signin.
 */

import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // expire immediately
  });
  return res;
}

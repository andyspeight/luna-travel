/**
 * POST /api/admin/signout
 *
 * Clears the admin session cookie. Idempotent — safe to call when already
 * signed out. Returns 200 either way; the client redirects to /admin/signin.
 *
 * Logs an admin.signout audit event for the email that was signed in
 * (if any). If there's no valid cookie, no event is logged — there's
 * no actor to attribute the event to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '@/lib/admin-session';
import { logAuditEvent, getRequestIp } from '@/lib/audit';

export async function POST(req: NextRequest) {
  // Read the existing cookie to discover who's signing out (for audit).
  // We do this before clearing.
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (token) {
    const claims = await verifyAdminSession(token);
    if (claims) {
      void logAuditEvent({
        eventType: 'admin.signout',
        actor: claims.email,
        metadata: { ip: getRequestIp(req) },
      });
    }
  }

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

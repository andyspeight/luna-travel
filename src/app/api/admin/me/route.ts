/**
 * GET /api/admin/me
 *
 * Returns the signed-in admin's identity (email + role on luna_travel).
 * Used by the admin layout to show "who am I" in the top bar.
 *
 * Auth is the central Travelgenix ID session (tg_session cookie). The
 * middleware already gates this route; we re-check here as belt-and-braces
 * in case the route ever falls outside middleware scope.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  // verifyAdminSession validates the central session by calling
  // id.travelify.io/api/auth/me, so it needs the full Cookie header
  // (not just one cookie value) to forward upstream.
  const claims = await verifyAdminSession(req.headers.get('cookie'));
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  return NextResponse.json({
    email: claims.email,
    role: claims.role,
    permissions: claims.permissions,
  });
}

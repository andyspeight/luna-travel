/**
 * GET /api/admin/me
 *
 * Returns the signed-in admin's email and domain. Used by the admin layout
 * to show "who am I" in the top bar.
 *
 * The middleware already gates this — if the request reaches here, the
 * caller is authenticated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  // Belt-and-braces — middleware already checks, but verify here too in
  // case the route ever falls outside middleware scope
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const claims = await verifyAdminSession(token);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  return NextResponse.json({
    email: claims.email,
    domain: claims.domain,
  });
}

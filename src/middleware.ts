/**
 * Edge middleware — gates the admin surface and admin APIs.
 *
 * Matches:
 *   /admin/*       — except /admin/signin (the sign-in page itself)
 *   /api/invites*  — invite creation and lookup (but NOT /api/invites/[id]/redeem,
 *                    which travellers hit during onboarding and must stay public)
 *
 * Behaviour:
 *   - Page route under /admin/*  → redirect to /admin/signin?return=<original>
 *   - API route under /api/invites* → 401 JSON
 *
 * Tomorrow when we move to a *.travelify.io subdomain, this middleware will
 * also check for the central `tg_session` cookie issued by id.travelify.io.
 * For now it only checks the local `lt_admin_session` cookie set by the
 * Luna Travel sign-in page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const config = {
  // Apply to admin pages, admin APIs, and the invite API.
  // /api/invites/[id]/redeem (traveller redemption) and /api/admin/signin
  // /signout (the sign-in flow itself) are explicitly let through in the
  // handler below.
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/invites/:path*',
    '/api/invites',
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Sign-in page itself is public — without this, redirect loop
  if (pathname === '/admin/signin' || pathname === '/admin/signin/') {
    return NextResponse.next();
  }

  // 2. Sign-in and sign-out APIs are public — without this, the user can't
  //    actually sign in
  if (pathname === '/api/admin/signin' || pathname === '/api/admin/signout') {
    return NextResponse.next();
  }

  // 3. Traveller redemption endpoint MUST stay public — travellers don't
  //    have admin credentials, that's the whole point. Match /api/invites/{id}/redeem
  if (/^\/api\/invites\/[^/]+\/redeem\/?$/.test(pathname)) {
    return NextResponse.next();
  }

  // 4. Everything else under the matched paths needs a valid admin cookie
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorised(req, pathname);
  }

  const claims = await verifyAdminSession(token);
  if (!claims) {
    return unauthorised(req, pathname);
  }

  // Pass through with the email available to downstream handlers if they want it
  const res = NextResponse.next();
  res.headers.set('x-admin-email', claims.email);
  return res;
}

function unauthorised(req: NextRequest, pathname: string) {
  const isApi = pathname.startsWith('/api/');
  if (isApi) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  // Page request — redirect to sign-in with return URL
  const url = req.nextUrl.clone();
  url.pathname = '/admin/signin';
  url.search = `?return=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

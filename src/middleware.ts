/**
 * Edge middleware — gates the admin APIs using the central Travelgenix ID
 * session (tg_session cookie).
 *
 * WHAT CHANGED (SSO migration, 26 May 2026):
 *   - Admin PAGES (/admin/*) are no longer gated here. They are gated
 *     client-side by tg-auth-gate.js, which is included in the admin layout
 *     <head>. That script handles sign-in redirect and the luna_travel
 *     permission check, consistent with every other Travelgenix product.
 *   - Admin API ROUTES are still gated here, server-side, because a
 *     client-side gate cannot protect an API endpoint. We validate the
 *     central session by calling id.travelify.io/api/auth/me (see
 *     lib/admin-session.ts).
 *   - The old local lt_admin_session cookie and shared ADMIN_PASSWORD are
 *     gone. Auth is now per-user via Travelgenix ID.
 *
 * Matches ONLY the admin/invite APIs now — not the admin pages.
 *   /api/admin/*   — admin API surface
 *   /api/invites*  — invite creation (POST, admin) and lookup/redeem
 *                    (public, traveller-facing). The public endpoints are
 *                    allowlisted below; everything else needs an admin session.
 *
 * PUBLIC, traveller-facing exceptions (no admin session required):
 *   - POST /api/invites/[id]/redeem  — a traveller redeems their invite.
 *   - GET  /api/invites/[id]         — the install page reads the invite to
 *                                      pre-fill the booking ref before the
 *                                      traveller has any session. The route
 *                                      itself returns only safe fields
 *                                      (status, agencyId, booking ref).
 *   - POST /api/admin/agencies/[id]/upload-logo — Vercel Blob webhook leg.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-session';

export const config = {
  // Apply ONLY to the admin/invite APIs. Pages are gated client-side now.
  matcher: ['/api/admin/:path*', '/api/invites/:path*', '/api/invites'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Traveller redemption endpoint MUST stay public — travellers don't
  //    have admin sessions, that's the whole point.
  //    Match /api/invites/{id}/redeem
  if (/^\/api\/invites\/[^/]+\/redeem\/?$/.test(pathname)) {
    return NextResponse.next();
  }

  // 1a. Public invite lookup — GET ONLY. The /install page calls this before
  //     the traveller has any session, to pre-fill the booking reference and
  //     read the invite status. The route returns only safe fields (status,
  //     agencyId, booking ref — see /api/invites/[id]/route.ts), so it is
  //     intended to be open. Gated to GET so that POST /api/invites (invite
  //     creation) stays admin-only. The redeem POST is handled above and the
  //     extra /redeem path segment keeps it out of this single-segment match.
  //     Match GET /api/invites/{id}
  if (req.method === 'GET' && /^\/api\/invites\/[^/]+\/?$/.test(pathname)) {
    return NextResponse.next();
  }

  // 1b. Logo upload uses the Vercel Blob client-upload pattern, which has TWO
  //     calls: the browser's token request (carries the tg_session cookie) and
  //     a server-to-server "upload-completed" webhook from Vercel that carries
  //     NO cookie. If middleware gated the webhook it would 401 before the
  //     route's handleUpload could verify it cryptographically — which breaks
  //     the whole token flow ("Failed to retrieve the client token"). So we let
  //     this route through here; it does its OWN auth: requireAdmin gates the
  //     token request, and handleUpload verifies the webhook via the Blob
  //     public key. Same design as the widgets' /api/upload-pdf.
  //     Match /api/admin/agencies/{id}/upload-logo
  if (/^\/api\/admin\/agencies\/[^/]+\/upload-logo\/?$/.test(pathname)) {
    return NextResponse.next();
  }

  // 2. Validate the central session. We forward the whole Cookie header to
  //    Travelgenix ID; verifyAdminSession returns claims only if the
  //    session is valid AND the user holds a luna_travel permission.
  const claims = await verifyAdminSession(req.headers.get('cookie'));
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // 3. Pass through, making identity available to downstream handlers.
  const res = NextResponse.next();
  res.headers.set('x-admin-email', claims.email);
  res.headers.set('x-admin-role', claims.role);
  return res;
}

/**
 * Edge middleware — two jobs:
 *
 *   1. DOMAIN SPLIT. Luna Travel runs on two hosts (see lib/origins.ts): the
 *      traveller app and the agency/admin portal. This sends each page request
 *      to the host that owns it. Opt-in via env; off, nothing changes.
 *   2. Gates the admin APIs using the central Travelgenix ID session
 *      (tg_session cookie).
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
 * The matcher now covers pages too (for job 1), but the admin gate itself is
 * explicitly re-scoped to the admin/invite APIs — see isGatedApiPath.
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
import {
  DOMAIN_SPLIT_ENABLED,
  PORTAL_HOST,
  PORTAL_ORIGIN,
  TRAVELLER_HOST,
  TRAVELLER_ORIGIN,
  isPortalPath,
} from '@/lib/origins';

export const config = {
  /**
   * Broadened from the admin APIs to (almost) everything, because the domain
   * split below has to see page requests too. Static assets are excluded —
   * notably manifest.json and sw.js, which the PWA must be able to fetch on
   * whichever host it was installed from.
   *
   * The admin/invite API gating below is explicitly re-scoped to the paths it
   * always covered, so widening the matcher does not widen the gate.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|images/|fonts/|manifest\\.json|version\\.json|sw\\.js|workbox-|robots\\.txt|sitemap\\.xml).*)',
  ],
};

/** Paths that were gated before the matcher was widened — unchanged in scope. */
function isGatedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/admin/') ||
    pathname === '/api/admin' ||
    pathname === '/api/invites' ||
    pathname.startsWith('/api/invites/')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ───────── 0. Domain split — send each page to the host that owns it ─────────
  //
  // Pages only. API routes are deliberately left reachable on both hosts: the
  // app calls them same-origin from whichever domain it is running on, and
  // redirecting a non-GET request across origins is a good way to lose a body
  // or a cookie. Each API authenticates on its own cookie anyway.
  //
  // Traveller pages stay reachable on the portal host by REDIRECT rather than
  // 404, because invite links already in the wild point at the portal host.
  // Path and query are preserved, so /install?invite=… lands intact and the
  // session cookie is then set on the traveller domain where it belongs.
  //
  // 307 (temporary) not 308: during rollout a permanently-cached redirect in
  // every traveller's browser would be painful to undo. Promote to 308 once
  // the split has been stable for a while.
  if (
    DOMAIN_SPLIT_ENABLED &&
    !pathname.startsWith('/api/') &&
    (req.method === 'GET' || req.method === 'HEAD')
  ) {
    const host = (req.headers.get('host') || '').toLowerCase();
    const wantsPortal = isPortalPath(pathname);

    if (wantsPortal && host === TRAVELLER_HOST) {
      return NextResponse.redirect(new URL(pathname + req.nextUrl.search, PORTAL_ORIGIN), 307);
    }
    if (!wantsPortal && host === PORTAL_HOST) {
      return NextResponse.redirect(new URL(pathname + req.nextUrl.search, TRAVELLER_ORIGIN), 307);
    }
    // Any other host (vercel.app previews, localhost) serves everything, which
    // keeps preview deployments and local development working untouched.
  }

  // Everything the old matcher did not cover passes straight through.
  if (!isGatedApiPath(pathname)) {
    return NextResponse.next();
  }

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

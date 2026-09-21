/**
 * Admin session — central SSO validation.
 *
 * Luna Travel admin now uses Travelgenix ID (id.travelify.io) for auth,
 * exactly like every other Travelgenix product. There is no local admin
 * password and no local admin JWT any more — the old lt_admin_session
 * mechanism has been retired in favour of the central tg_session cookie.
 *
 * How it works:
 *   - The browser carries the `tg_session` cookie (HttpOnly, Secure,
 *     SameSite=Lax, scoped to .travelify.io). Because Luna Travel admin is
 *     served from lunatravel.travelify.io, that cookie is sent with every
 *     request.
 *   - Admin PAGES are gated by the admin layout itself. It calls
 *     /api/admin/me and, on a 401, reads the `reason` this module supplies:
 *     it sends a signed-out person to Travelgenix ID, and shows somebody
 *     without the `luna_travel` permission a screen saying so rather than
 *     telling them to sign in again, which would never have worked.
 *   - Admin API ROUTES are gated server-side by this module. A client-side
 *     gate cannot protect an API (anyone can curl it directly), so the
 *     middleware calls requireAdmin() / verifyAdminSession() here to
 *     validate the session on the edge before letting the request through.
 *
 * Single source of truth for the session shape is Travelgenix ID's
 * /api/auth/me response. This module is the only place that reads it, and the
 * admin layout takes what it needs from this module, so the server and the
 * client cannot drift apart.
 */

const ID_HOST = 'https://id.travelify.io';
const ME_URL = ID_HOST + '/api/auth/me';

// The product slug this app gates on. Must match the slug in the
// Travelgenix ID Products table (base appAYzWZxvK6qlwXK).
export const PRODUCT_SLUG = 'luna_travel';

// The central session cookie issued by id.travelify.io.
export const ADMIN_COOKIE_NAME = 'tg_session';

/**
 * A single permission entry as returned by /api/auth/me.
 */
export type TgPermission = {
  product: string;
  role: string;
};

/**
 * The claims we expose to downstream handlers once a session is validated.
 * `role` is the user's role for THIS product (luna_travel), resolved from
 * the permissions array. Kept deliberately small — handlers that need more
 * can read the raw session.
 */
export type AdminClaims = {
  email: string;
  role: string; // role on luna_travel: 'owner' | 'admin'
  permissions: TgPermission[];
};

/**
 * Why a session check failed, when it did.
 *
 * These used to collapse into a single `null`, and the admin screen turned
 * every one of them into "Your session has expired - please sign in again."
 * For a missing permission that sentence is actively false: signing in again
 * produces the identical message, forever, with nothing on screen to suggest
 * otherwise. Somebody hit that loop two weeks running.
 */
export type AdminAuthState =
  /** Valid session, holds luna_travel. */
  | { state: 'ok'; claims: AdminClaims }
  /** No session, or Travelgenix ID rejected it. Signing in will fix it. */
  | { state: 'signed-out' }
  /** Signed in, but without luna_travel. Signing in again will NOT fix it. */
  | { state: 'no-permission'; email: string }
  /** Control was unreachable. Neither the user's fault nor their problem. */
  | { state: 'unavailable' };

/**
 * Where to send somebody who needs to sign in.
 *
 * Travelgenix ID owns the sign-in screen; Luna Travel only needs to hand over
 * the return address. Kept here so the one place that knows the ID host is the
 * one place that builds URLs into it.
 */
export function signInUrl(returnTo: string): string {
  return `${ID_HOST}/signin?redirect=${encodeURIComponent(returnTo)}`;
}

/**
 * Validate a central session by calling Travelgenix ID's /api/auth/me with
 * the caller's tg_session cookie forwarded verbatim.
 *
 * IMPORTANT: this runs server-side (Edge middleware / route handlers), so
 * there is no browser to attach the cookie automatically. We forward the
 * cookie header explicitly.
 *
 * @param cookieHeader  The full `Cookie` header from the incoming request,
 *                      or just the tg_session value — we forward whatever
 *                      we're given as the Cookie header.
 * @returns AdminClaims if the session is valid AND the user holds a
 *          luna_travel permission; otherwise null.
 */
export async function verifyAdminSession(
  cookieHeader: string | null | undefined
): Promise<AdminClaims | null> {
  const result = await checkAdminSession(cookieHeader);
  return result.state === 'ok' ? result.claims : null;
}

/**
 * The same check, but saying why it failed.
 *
 * verifyAdminSession stays as the boolean-ish wrapper because every existing
 * caller only wants claims-or-nothing, and a gate has no use for the reason.
 * The admin screen does: it is the difference between "sign in again" and
 * "signing in again will not help you".
 */
export async function checkAdminSession(
  cookieHeader: string | null | undefined
): Promise<AdminAuthState> {
  if (!cookieHeader) return { state: 'signed-out' };

  // Bound the call so a slow/hanging Control can never stall the caller. This
  // runs in Edge middleware on every admin API request; without a timeout a
  // stuck /api/auth/me hangs the whole function to Vercel's 25s limit and the
  // request 504s (observed on /api/admin/settings). 9s comfortably covers a
  // cold Control (Airtable) response while still failing fast on a real hang.
  let res: Response;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 9000);
  try {
    res = await fetch(ME_URL, {
      method: 'GET',
      headers: {
        // Forward the session cookie to Travelgenix ID.
        Cookie: cookieHeader,
        Accept: 'application/json'
      },
      // Never cache an auth check.
      cache: 'no-store',
      signal: ctrl.signal
    });
  } catch {
    // Network error, or the timeout aborted the request — fail closed, but
    // say it was us. Telling somebody to sign in again because Control blipped
    // sends them round a loop that cannot help.
    return { state: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) return { state: 'signed-out' };
  if (!res.ok) return { state: 'unavailable' };

  let data: any;
  try {
    data = await res.json();
  } catch {
    return { state: 'unavailable' };
  }

  if (!data || data.ok !== true) return { state: 'signed-out' };

  const email =
    data.user && typeof data.user.email === 'string' ? data.user.email : null;
  if (!email) return { state: 'signed-out' };

  const permissions: TgPermission[] = Array.isArray(data.permissions)
    ? data.permissions.filter(
        (p: any) =>
          p && typeof p.product === 'string' && typeof p.role === 'string'
      )
    : [];

  // Must hold a permission for THIS product to reach admin. A real session
  // without it is the case worth naming: the person is who they say they are,
  // they simply have not been granted Luna Travel.
  const match = permissions.find((p) => p.product === PRODUCT_SLUG);
  if (!match) return { state: 'no-permission', email };

  return {
    state: 'ok',
    claims: { email, role: match.role, permissions }
  };
}

/**
 * Convenience helper for route handlers. Pass the incoming Request; returns
 * claims or null. Lets an API route do its own check without going through
 * middleware, e.g.:
 *
 *   const claims = await requireAdmin(req);
 *   if (!claims) return new Response('unauthorised', { status: 401 });
 */
export async function requireAdmin(req: Request): Promise<AdminClaims | null> {
  return verifyAdminSession(req.headers.get('cookie'));
}

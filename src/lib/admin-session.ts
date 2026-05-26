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
 *   - Admin PAGES are gated client-side by tg-auth-gate.js (see the
 *     <script> tag in the admin layout). That script calls /api/auth/me,
 *     checks the `luna_travel` product permission, and either renders the
 *     page or shows a "no access" screen.
 *   - Admin API ROUTES are gated server-side by this module. A client-side
 *     gate cannot protect an API (anyone can curl it directly), so the
 *     middleware calls requireAdmin() / verifyAdminSession() here to
 *     validate the session on the edge before letting the request through.
 *
 * Single source of truth for the session shape is Travelgenix ID's
 * /api/auth/me response, mirrored by tg-auth-gate.js. We read the same
 * fields here so the server and client can never drift apart.
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
  if (!cookieHeader) return null;

  let res: Response;
  try {
    res = await fetch(ME_URL, {
      method: 'GET',
      headers: {
        // Forward the session cookie to Travelgenix ID.
        Cookie: cookieHeader,
        Accept: 'application/json'
      },
      // Never cache an auth check.
      cache: 'no-store'
    });
  } catch {
    // Network error reaching id.travelify.io — fail closed.
    return null;
  }

  if (res.status === 401) return null;
  if (!res.ok) return null;

  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  // Mirror the contract used by tg-auth-gate.js.
  if (!data || data.ok !== true) return null;

  const email =
    data.user && typeof data.user.email === 'string' ? data.user.email : null;
  if (!email) return null;

  const permissions: TgPermission[] = Array.isArray(data.permissions)
    ? data.permissions.filter(
        (p: any) =>
          p && typeof p.product === 'string' && typeof p.role === 'string'
      )
    : [];

  // Must hold a permission for THIS product to reach admin.
  const match = permissions.find((p) => p.product === PRODUCT_SLUG);
  if (!match) return null;

  return {
    email,
    role: match.role,
    permissions
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

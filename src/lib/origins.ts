/**
 * Domain split — which host serves what.
 *
 * Luna Travel is ONE Next.js app served on TWO public domains:
 *
 *   TRAVELLER   my-booking.co             The customer's trip app. Consumer
 *                                         facing and agency-neutral: it carries
 *                                         whichever agency's branding the
 *                                         booking belongs to, so the hostname
 *                                         must not say "travelify".
 *   PORTAL      lunatravel.travelify.io   The agency portal (/agency) and the
 *                                         platform admin (/admin).
 *
 * Why the portal side CANNOT move to the traveller domain: admin auth is the
 * central Travelgenix ID `tg_session` cookie, which is scoped to .travelify.io.
 * On any other host the browser simply never sends it, so /admin — and the
 * Control SSO hand-off at /api/agency/session/sso, which reads the same cookie
 * — only work on a travelify.io hostname. This is a hard constraint, not a
 * preference.
 *
 * The two session cookies are host-only (neither sets a `domain` attribute), so
 * splitting the hosts also cleanly separates traveller sessions from agency
 * sessions. Nothing to change there.
 *
 * ROLLOUT IS OPT-IN. With the env vars unset the app behaves exactly as it did
 * on a single domain: every route is served on every host, and links are built
 * from the incoming request. Setting BOTH vars switches on canonical link
 * building and the cross-domain redirects. Removing them switches it back off,
 * which is the rollback.
 *
 * Both are NEXT_PUBLIC_ because edge middleware and client components need them
 * inlined at build time. They are public hostnames — nothing secret.
 */

/** Normalise a configured origin: add https:// if missing, drop path/trailing slash. */
function normaliseOrigin(raw: string | undefined): string {
  const v = (raw || '').trim();
  if (!v) return '';
  const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return '';
  }
}

/**
 * Written as direct `process.env.NEXT_PUBLIC_*` references so Next.js inlines
 * them at build time — a dynamic lookup would not be replaced and would read as
 * undefined in the browser and on the edge.
 */
export const TRAVELLER_ORIGIN = normaliseOrigin(process.env.NEXT_PUBLIC_TRAVELLER_ORIGIN);
export const PORTAL_ORIGIN = normaliseOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);

function hostOf(origin: string): string {
  if (!origin) return '';
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return '';
  }
}

export const TRAVELLER_HOST = hostOf(TRAVELLER_ORIGIN);
export const PORTAL_HOST = hostOf(PORTAL_ORIGIN);

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Does an incoming Host header belong to this configured site? `www.` is
 * ignored on both sides, so `www.my-booking.co` counts as the traveller host
 * even though the configured origin is the apex.
 *
 * This matters because the apex/www redirect is a DOMAIN-level Vercel rule that
 * runs before middleware. Without this, whichever of the pair is not configured
 * looks like an unknown host, falls through to "serve everything", and quietly
 * exposes /agency and /admin on the consumer domain.
 *
 * Deliberately no canonical www→apex redirect here: Vercel already owns that
 * direction, and adding our own would bounce the request between the two hosts
 * forever.
 */
export function hostMatches(requestHost: string, configuredHost: string): boolean {
  if (!requestHost || !configuredHost) return false;
  return stripWww(requestHost.toLowerCase()) === stripWww(configuredHost);
}

/**
 * Both configured AND genuinely different → the split is live. One alone is
 * ignored, and identical hosts are rejected because the redirect rules would
 * otherwise bounce a request between the same host forever.
 */
export const DOMAIN_SPLIT_ENABLED = Boolean(
  TRAVELLER_ORIGIN && PORTAL_ORIGIN && TRAVELLER_HOST !== PORTAL_HOST,
);

/**
 * Routes that belong to the portal domain. Everything else that is a page is
 * traveller-facing — so a new traveller screen needs no change here, while
 * anything agent- or admin-facing simply lives under /agency or /admin.
 */
const PORTAL_PREFIXES = ['/agency', '/admin'] as const;

export function isPortalPath(pathname: string): boolean {
  return PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The portal host's front door.
 *
 * Nothing at `/` is portal-facing — the app's root IS the traveller's trip — so
 * without a rule of its own the portal domain redirected its own home page to
 * the traveller domain. Typing lunatravel.travelify.io put you in the customer
 * app, which made the two domains look like they pointed at the same place when
 * in fact only this one path did.
 *
 * /agency rather than /admin: the domain is where agents work. Travelgenix
 * staff reach the console by typing /admin, which is a portal path already.
 */
export const PORTAL_HOME = '/agency';

export interface HostRoute {
  /** Absolute origin to send the request to. */
  origin: string;
  /** Path at that origin. Usually unchanged. */
  path: string;
}

/** The hosts a routing decision is made against. Injectable so it can be tested. */
export interface HostConfig {
  travellerHost: string;
  portalHost: string;
  travellerOrigin: string;
  portalOrigin: string;
}

function currentConfig(): HostConfig {
  return {
    travellerHost: TRAVELLER_HOST,
    portalHost: PORTAL_HOST,
    travellerOrigin: TRAVELLER_ORIGIN,
    portalOrigin: PORTAL_ORIGIN,
  };
}

/**
 * Where a page request belongs, or null to serve it where it landed.
 *
 * Pulled out of the middleware so the rules can be read and tested in one
 * place — the bug this fixes was a missing case, which is exactly the kind of
 * thing a table of examples catches and a walk through an if-chain does not.
 *
 * An unrecognised host (vercel.app previews, localhost) always returns null, so
 * preview deployments and local development keep serving everything.
 */
export function routeForHost(
  requestHost: string,
  pathname: string,
  cfg: HostConfig = currentConfig(),
): HostRoute | null {
  const split = Boolean(
    cfg.travellerOrigin && cfg.portalOrigin && cfg.travellerHost !== cfg.portalHost,
  );
  if (!split) return null;

  const onPortalHost = hostMatches(requestHost, cfg.portalHost);
  const onTravellerHost = hostMatches(requestHost, cfg.travellerHost);

  if (isPortalPath(pathname)) {
    // Agent and admin pages belong on the portal host.
    return onTravellerHost ? { origin: cfg.portalOrigin, path: pathname } : null;
  }

  if (!onPortalHost) return null;

  // The portal host's own home page. Checked before the catch-all below, which
  // would otherwise send it to the traveller app.
  if (pathname === '/') return { origin: cfg.portalOrigin, path: PORTAL_HOME };

  // Any other traveller page that landed on the portal host — invite links
  // already in the wild point here. Redirected rather than 404ed so they still
  // work, and so the session cookie is set on the domain that owns it.
  return { origin: cfg.travellerOrigin, path: pathname };
}

/**
 * Canonical absolute URL for a traveller-facing path (invite links, QR codes).
 * Falls back to the request's own origin when the split isn't configured, which
 * is the pre-split behaviour.
 */
export function travellerUrl(path: string, requestOrigin: string): string {
  return `${TRAVELLER_ORIGIN || requestOrigin}${path}`;
}

/** Canonical absolute URL for a portal-facing path (agency sign-in links). */
export function portalUrl(path: string, requestOrigin: string): string {
  return `${PORTAL_ORIGIN || requestOrigin}${path}`;
}

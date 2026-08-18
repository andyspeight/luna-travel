/**
 * Agency portal session.
 *
 * Two kinds of agency reach the portal, and both end up with this same
 * `lt_agency_session` cookie:
 *   - Control agencies (id `rec…`) arrive from their Travelgenix Control
 *     dashboard already carrying the central tg_session, which we exchange for
 *     this session (see agency-sso.ts). Open access — no magic link.
 *   - Luna-native agencies (id `lt…`) are non-Travelgenix clients with no SSO,
 *     so they sign in via a magic link (see agency-login.ts).
 *
 * It deliberately mirrors the traveller session (jwt.ts): HS256 over JWT_SECRET,
 * cheap to verify on every request, no key distribution. The claim carries a
 * fixed `kind: 'agency'` so an agency token can never be mistaken for a
 * traveller `lt_session` (or vice-versa) even though they share the secret. It
 * also carries `source` (which store owns the agency) and, for Control agencies
 * whose name is not in the Luna store, the display `agencyName`.
 *
 * Lifetime: 30 days. When it lapses a Control agency is re-issued transparently
 * on the next visit from Control; a Luna-native agency requests a fresh link.
 */

import { SignJWT, jwtVerify } from 'jose';
import { isControlAgency } from '@/lib/agency-id';

const ALG = 'HS256';
const EXPIRY = '30d';
export const AGENCY_COOKIE_NAME = 'lt_agency_session';
// Max-Age in seconds for the Set-Cookie header (kept in step with EXPIRY).
export const AGENCY_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET not set');
  if (raw.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  return new TextEncoder().encode(raw);
}

export type AgencySource = 'control' | 'luna';

export type AgencyClaims = {
  kind: 'agency';
  agencyId: string;
  email: string;
  source: AgencySource;
  /** Display name — carried for Control agencies (not in the Luna store). */
  agencyName?: string;
};

/**
 * Sign an agency portal session JWT. `source` defaults to the agency-id prefix
 * (rec… → control, lt… → luna) so existing callers need not pass it.
 */
export async function signAgencySession(
  claims: { agencyId: string; email: string; source?: AgencySource; agencyName?: string },
): Promise<string> {
  const source: AgencySource = claims.source ?? (isControlAgency(claims.agencyId) ? 'control' : 'luna');
  return new SignJWT({
    kind: 'agency',
    agencyId: claims.agencyId,
    email: claims.email,
    source,
    ...(claims.agencyName ? { agencyName: claims.agencyName } : {}),
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

/**
 * Verify an agency session JWT. Returns claims on success, null on any failure
 * (expired, malformed, wrong signature, wrong kind). Never throws.
 */
export async function verifyAgencySession(token: string): Promise<AgencyClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      payload.kind === 'agency' &&
      typeof payload.agencyId === 'string' &&
      typeof payload.email === 'string'
    ) {
      // `source` was added later; older tokens infer it from the id prefix.
      const source: AgencySource =
        payload.source === 'control' || payload.source === 'luna'
          ? payload.source
          : isControlAgency(payload.agencyId)
            ? 'control'
            : 'luna';
      const agencyName = typeof payload.agencyName === 'string' ? payload.agencyName : undefined;
      return { kind: 'agency', agencyId: payload.agencyId, email: payload.email, source, agencyName };
    }
    return null;
  } catch {
    return null;
  }
}

/** Read the lt_agency_session cookie value from a request's Cookie header. */
function readAgencyCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === AGENCY_COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Route-handler convenience: return the agency claims for the current request,
 * or null if there is no valid agency session. Callers treat null as 401.
 */
export async function requireAgency(req: Request): Promise<AgencyClaims | null> {
  const token = readAgencyCookie(req.headers.get('cookie'));
  if (!token) return null;
  return verifyAgencySession(token);
}

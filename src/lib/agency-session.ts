/**
 * Agency portal session.
 *
 * Luna-native agencies (id `lt…`) are non-Travelgenix clients, so they cannot
 * use Travelgenix ID SSO. Instead they sign in via a magic link (see
 * agency-login.ts) which, once consumed, issues this session as an
 * `lt_agency_session` cookie.
 *
 * It deliberately mirrors the traveller session (jwt.ts): HS256 over JWT_SECRET,
 * cheap to verify on every request, no key distribution. The claim carries a
 * fixed `kind: 'agency'` so an agency token can never be mistaken for a
 * traveller `lt_session` (or vice-versa) even though they share the secret.
 *
 * Lifetime: 30 days. When it lapses the agency requests a fresh link.
 */

import { SignJWT, jwtVerify } from 'jose';

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

export type AgencyClaims = {
  kind: 'agency';
  agencyId: string;
  email: string;
};

/** Sign an agency portal session JWT. */
export async function signAgencySession(claims: Omit<AgencyClaims, 'kind'>): Promise<string> {
  return new SignJWT({ kind: 'agency', agencyId: claims.agencyId, email: claims.email })
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
      return { kind: 'agency', agencyId: payload.agencyId, email: payload.email };
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

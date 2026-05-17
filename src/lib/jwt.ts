/**
 * Session JWT helpers.
 *
 * The redemption endpoint signs a JWT after a successful Travelify lookup.
 * The traveller PWA reads it from the lt_session cookie (or Authorization
 * header) to identify which traveller is making subsequent requests.
 *
 * Algorithm: HS256 (symmetric, single secret). Cheap to verify on every
 * request, no key distribution needed. The secret lives in JWT_SECRET.
 *
 * Lifetime: 30 days. Matches the invite expiry. Refreshing happens at the
 * next redemption (re-scan, re-enter details) — we don't do silent token
 * refresh for now since the redemption flow is rare (once per trip).
 */

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const EXPIRY = '30d';

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET not set');
  if (raw.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  return new TextEncoder().encode(raw);
}

export type SessionClaims = {
  inviteId: string;
  travellerId: string;
  bookingRef: string;
  agencyId: string;
};

/**
 * Sign a session JWT. Includes standard iat (issued at) and exp claims
 * alongside the custom session claims.
 */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

/**
 * Verify a session JWT. Returns the claims on success, null on any failure
 * (expired, malformed, wrong signature, etc.). Never throws to the caller —
 * callers should treat null as "not authenticated" and return 401.
 */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.inviteId === 'string' &&
      typeof payload.travellerId === 'string' &&
      typeof payload.bookingRef === 'string' &&
      typeof payload.agencyId === 'string'
    ) {
      return {
        inviteId: payload.inviteId,
        travellerId: payload.travellerId,
        bookingRef: payload.bookingRef,
        agencyId: payload.agencyId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

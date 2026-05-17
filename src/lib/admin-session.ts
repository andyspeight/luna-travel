/**
 * Admin session helpers — gates access to /admin/* and /api/invites*.
 *
 * Separate from the traveller session (`lt_session` cookie). Admins are
 * Travelgenix staff managing agencies; travellers are the customers using
 * the PWA. The two should never be conflated, so they use different
 * cookies (`lt_admin_session`) and different claim shapes.
 *
 * Tomorrow's plan: when Luna Travel moves to a *.travelify.io subdomain,
 * the central tg_session cookie from id.travelify.io will be readable here.
 * The middleware will check both cookies; this local sign-in stays as a
 * fallback so day-to-day admin work isn't blocked if id.travelify.io is
 * unavailable, and to keep dev work simple.
 */

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const EXPIRY = '12h'; // shorter than traveller session — admins re-auth more often
export const ADMIN_COOKIE_NAME = 'lt_admin_session';

const ALLOWED_DOMAINS = ['travelgenix.io', 'agendas.group'];

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET not set');
  if (raw.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  return new TextEncoder().encode(raw);
}

export type AdminClaims = {
  email: string;
  domain: string;
};

/**
 * Check whether an email is on the staff allow-list. Today: any address on
 * the Travelgenix or Agendas Group domain. Tomorrow we extend to read the
 * central SSO cookie's package/role fields and accept agencies on the right
 * tier.
 */
export function isAllowedEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  // Basic shape — defence in depth, the form already validates this
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
}

/**
 * Verify the shared admin password from env. Constant-time-ish compare.
 * Not the strongest check in the world — single shared secret, no per-user
 * audit — but adequate for the interim while SSO is being plumbed in.
 */
export function verifyAdminPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8) return false;
  if (typeof submitted !== 'string') return false;
  if (submitted.length !== expected.length) return false;
  // Manual constant-time compare — small enough we don't need crypto.timingSafeEqual
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ submitted.charCodeAt(i);
  }
  return diff === 0;
}

export async function signAdminSession(email: string): Promise<string> {
  const domain = email.split('@')[1];
  return new SignJWT({ email, domain })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminSession(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.email === 'string' &&
      typeof payload.domain === 'string' &&
      ALLOWED_DOMAINS.includes(payload.domain)
    ) {
      return { email: payload.email, domain: payload.domain };
    }
    return null;
  } catch {
    return null;
  }
}

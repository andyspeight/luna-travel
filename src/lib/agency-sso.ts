/**
 * Control (Travelgenix ID) SSO → agency portal.
 *
 * A Control agency (a Clients record, id `rec…`) reaches the Luna agency portal
 * straight from its Control dashboard: the browser already carries the central
 * `tg_session` cookie (scoped to .travelify.io, so it is sent to
 * lunatravel.travelify.io too). We exchange that session for an agency portal
 * session — no magic link — by asking Control who they are.
 *
 * Trust model: Control is the source of truth. We call its /api/auth/me with the
 * caller's cookie, and only mint a session when the response says the caller's
 * CLIENT (their agency) may launch Luna Travel and is not suspended. The client
 * record id IS the canonical agency_id in Luna (see agency-id.ts), so no mapping
 * is needed — and because the id is read from Control's authenticated response
 * (never the request body), an agent can only ever be scoped to their OWN
 * agency. Fails closed on any doubt; never throws.
 */

import { isControlAgency } from '@/lib/agency-id';

const ME_URL = 'https://id.travelify.io/api/auth/me';
const PRODUCT_SLUG = 'luna_travel';

export interface ControlAgencyIdentity {
  /** Control client record id (`rec…`) = the canonical Luna agency_id. */
  agencyId: string;
  email: string;
  agencyName: string;
}

/**
 * Exchange a Control session (the tg_session cookie, forwarded verbatim as the
 * Cookie header) for a validated agency identity. Returns null when there is no
 * valid session, the caller has no client, the client is suspended, or the
 * client is not entitled to Luna Travel.
 */
export async function exchangeControlSession(
  cookieHeader: string | null | undefined,
): Promise<ControlAgencyIdentity | null> {
  if (!cookieHeader) return null;

  let res: Response;
  try {
    res = await fetch(ME_URL, {
      method: 'GET',
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return null; // network error reaching Control — fail closed
  }
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (!data || data.ok !== true) return null;

  const client = data.client;
  const agencyId = client && typeof client.recordId === 'string' ? client.recordId : '';
  // No client, or a shape we don't recognise as a Control agency id.
  if (!isControlAgency(agencyId)) return null;

  // A suspended client cannot use the portal even if entitlement rows linger.
  const status = typeof client.status === 'string' ? client.status.toLowerCase() : '';
  if (status === 'suspended') return null;

  // The client must be entitled to launch Luna Travel. accessibleProducts mirrors
  // the client's enabled entitlements — the same set that puts the Luna Travel
  // tile on their Control dashboard — so "sees the tile" == "can enter the portal".
  const products = Array.isArray(data.accessibleProducts) ? data.accessibleProducts : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entitled = products.some((p: any) => p && p.slug === PRODUCT_SLUG);
  if (!entitled) return null;

  const email = data.user && typeof data.user.email === 'string' ? data.user.email : '';
  const agencyName = typeof client.clientName === 'string' ? client.clientName : '';

  return { agencyId, email, agencyName };
}

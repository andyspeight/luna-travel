/**
 * "Acting as" an agency — the Luna Travel side of the platform-wide pattern.
 *
 * Travelgenix staff regularly need to work inside an agency they are not a
 * member of: today's case was creating an invite for a booking that lives in a
 * client's own Travelify account, which our credentials cannot reach. Widgets
 * and contracting already solve this; see tg-widgets/docs/act-as-scoping-spec.md
 * for the design and the incident that produced it.
 *
 * WHAT THIS IS NOT: the old global client switch. That re-minted the shared
 * tg_session, so acting as a client in one tool silently flipped every other
 * tool. Here the base session always stays the real staff member and
 * impersonation is a short-lived signed grant the browser presents per request,
 * held in one tab's sessionStorage. A second tab, and every other tool, stays
 * as you.
 *
 * WHY LUNA DOES NOT VERIFY THE GRANT ITSELF: Luna never verifies the central
 * session either — it forwards the cookie to Control and trusts the answer (see
 * admin-session.ts). The grant is forwarded exactly the same way, so the
 * signing secret stays in one place. Control applies the overlay inside its own
 * requireAuth and hands back the client it resolved to, which means the
 * security decision lives with the system that owns it.
 *
 * FAILS CLOSED TO YOURSELF. No header, an expired or tampered grant, a
 * non-staff caller, an unreachable Control: every one of them returns null and
 * the request runs as whoever the ordinary session says it is. The failure mode
 * is "you are you", never "you are silently them".
 */

const ME_URL = 'https://id.travelify.io/api/auth/me';

/** Lower-case: the same header the rest of the platform uses. */
export const ACT_AS_HEADER = 'x-tg-act-as';

export interface ActingAs {
  /** The agency being acted as — a Control record id. */
  agencyId: string;
  agencyName: string;
  /** The REAL person. Never the agency. This is what audit trails must show. */
  staffEmail: string;
}

export function readActAsHeader(req: Request): string {
  return (req.headers.get(ACT_AS_HEADER) || '').trim();
}

/**
 * Resolve the act-as overlay for a request, or null to run as the ordinary
 * session.
 *
 * Costs nothing when nobody is acting: with no header this returns immediately
 * without touching the network, which matters because it sits in front of every
 * agency API call.
 */
export async function resolveActAs(req: Request): Promise<ActingAs | null> {
  const grant = readActAsHeader(req);
  if (!grant) return null;

  const cookie = req.headers.get('cookie');
  if (!cookie) return null;

  // Bounded, for the same reason verifyAdminSession is: this runs on a request
  // path, and a stalled Control must not hold the whole function open.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 9000);
  let res: Response;
  try {
    res = await fetch(ME_URL, {
      method: 'GET',
      headers: { Cookie: cookie, 'X-TG-Act-As': grant, Accept: 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return null;

  let data: {
    ok?: boolean;
    isStaff?: boolean;
    user?: { email?: string };
    client?: { recordId?: string; clientName?: string; name?: string };
  };
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (!data || data.ok !== true) return null;

  // Staff only. Control already refuses to apply the overlay for anyone else,
  // so a non-staff caller gets their own client back — which is not
  // impersonation and must not be labelled or audited as if it were.
  if (data.isStaff !== true) return null;

  const agencyId = (data.client?.recordId || '').trim();
  const staffEmail = (data.user?.email || '').trim();
  if (!agencyId || !staffEmail) return null;

  return {
    agencyId,
    agencyName: (data.client?.clientName || data.client?.name || '').trim() || 'this agency',
    staffEmail,
  };
}

/**
 * Audit metadata for a request that may be an act-as. Spread into an existing
 * metadata object; contributes nothing when nobody is acting.
 *
 * The actor on these events is already the real staff email, because that is
 * what the claims carry while acting. This adds the other half, so the trail
 * reads "Andy, acting as Cypher Travel, created an invite" rather than leaving
 * a reader to wonder why Andy was writing into someone else's agency.
 */
export function actingAsMeta(actingAs?: ActingAs): Record<string, unknown> {
  if (!actingAs) return {};
  return { actingAsAgency: actingAs.agencyName, actingAsAgencyId: actingAs.agencyId };
}

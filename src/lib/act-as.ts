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
 * TWO DIFFERENT FAILURES, AND THEY ARE NOT THE SAME.
 *
 * "No header" means nobody is acting: run as the ordinary session. That is the
 * safe fallback and it is what almost every request does.
 *
 * "Header present but it did not resolve" means somebody BELIEVES they are
 * acting and they are not — an expired grant, a tampered one, an unreachable
 * Control. Running that as the ordinary session is NOT safe, and treating the
 * two alike caused a real incident: a grant quietly expired (they are capped at
 * 30 minutes), the portal fell back to the staff member's own agency, and an
 * invite for a client's booking was filed under Travelgenix instead. Nothing
 * errored. It surfaced days later as the client being told to check their own
 * details for a booking that was never reachable from that agency.
 *
 * So the outcomes are distinct, and 'invalid' fails the REQUEST rather than
 * falling back. For a read that is a harmless 401 the portal recovers from; for
 * a write it is the difference between an error and silent corruption.
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
 * What the act-as header on this request amounted to.
 *
 * 'none'    nobody is acting — run as the ordinary session
 * 'acting'  resolved; this is the agency for the request
 * 'invalid' a grant was presented and refused — fail the request
 */
export type ActAsOutcome =
  | { kind: 'none' }
  | { kind: 'acting'; actingAs: ActingAs }
  | { kind: 'invalid' };

const NONE: ActAsOutcome = { kind: 'none' };
const INVALID: ActAsOutcome = { kind: 'invalid' };

/**
 * Resolve the act-as overlay for a request, or null to run as the ordinary
 * session.
 *
 * Costs nothing when nobody is acting: with no header this returns immediately
 * without touching the network, which matters because it sits in front of every
 * agency API call.
 */
export async function resolveActAs(req: Request): Promise<ActAsOutcome> {
  const grant = readActAsHeader(req);
  if (!grant) return NONE;

  // From here on the caller has asserted they are acting as someone. Every exit
  // below is INVALID, never NONE: if we cannot honour the assertion we refuse
  // the request rather than quietly serving them their own agency.
  const cookie = req.headers.get('cookie');
  if (!cookie) return INVALID;

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
    return INVALID;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return INVALID;

  let data: {
    ok?: boolean;
    isStaff?: boolean;
    user?: { email?: string };
    client?: { recordId?: string; clientName?: string; name?: string };
  };
  try {
    data = await res.json();
  } catch {
    return INVALID;
  }

  if (!data || data.ok !== true) return INVALID;

  // Staff only. Control refuses to apply the overlay for anyone else and hands
  // back their own client instead — which is not impersonation and must not be
  // labelled or audited as if it were. Refusing rather than accepting that
  // answer keeps "acting" meaning exactly one thing.
  if (data.isStaff !== true) return INVALID;

  const agencyId = (data.client?.recordId || '').trim();
  const staffEmail = (data.user?.email || '').trim();
  if (!agencyId || !staffEmail) return INVALID;

  return {
    kind: 'acting',
    actingAs: {
      agencyId,
      agencyName: (data.client?.clientName || data.client?.name || '').trim() || 'this agency',
      staffEmail,
    },
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

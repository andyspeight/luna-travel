/**
 * Acting as an agency — the outcome rules.
 *
 * These exist because of a live incident. A Travelgenix staff member acted as a
 * client agency, the grant quietly expired (they are capped at 30 minutes), and
 * the portal fell back to running as the staff member's OWN agency. An invite
 * for the client's booking was filed under Travelgenix, went out by email, and
 * surfaced days later as the client being told to check their own details for a
 * booking that agency could never reach.
 *
 * The rule the tests below pin down: "no grant" and "a grant we refused" are
 * different answers, and only the first may fall back to the ordinary session.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveActAs } from '@/lib/act-as';
import { requireAgency, signAgencySession } from '@/lib/agency-session';

const REAL_FETCH = globalThis.fetch;

/** Make Control answer with this, for one call. */
function control(body: unknown, status = 200) {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function req(headers: Record<string, string>): Request {
  return new Request('https://lunatravel.travelify.io/api/agency/invites', { headers });
}

const STAFF_OK = {
  ok: true,
  isStaff: true,
  user: { email: 'andy@travelgenix.io' },
  client: { recordId: 'recRA6kkeuHKY7acT', clientName: 'Your Ticket Genie' },
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
});

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  vi.restoreAllMocks();
});

describe('resolveActAs', () => {
  it('is "none" when nobody is acting, without touching the network', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('should not be called');
    }) as unknown as typeof fetch;

    expect(await resolveActAs(req({ cookie: 'tg_session=abc' }))).toEqual({ kind: 'none' });
  });

  it('is "acting" when Control resolves the grant for a staff member', async () => {
    control(STAFF_OK);
    const out = await resolveActAs(req({ cookie: 'tg_session=abc', 'x-tg-act-as': 'grant' }));

    expect(out.kind).toBe('acting');
    if (out.kind !== 'acting') return;
    expect(out.actingAs.agencyId).toBe('recRA6kkeuHKY7acT');
    expect(out.actingAs.agencyName).toBe('Your Ticket Genie');
    // The REAL person, never the agency — audit trails depend on this.
    expect(out.actingAs.staffEmail).toBe('andy@travelgenix.io');
  });

  // Every one of these presented a grant. None may answer "none", because that
  // is the answer that silently runs the request as yourself.
  it.each([
    ['Control refuses the grant (expired or tampered)', { ok: false }, 401],
    ['Control answers ok:false', { ok: false }, 200],
    ['the caller is not staff', { ...STAFF_OK, isStaff: false }, 200],
    ['no client came back', { ok: true, isStaff: true, user: { email: 'a@b.co' } }, 200],
    ['no user came back', { ok: true, isStaff: true, client: { recordId: 'recX' } }, 200],
  ])('is "invalid" when %s', async (_label, body, status) => {
    control(body, status);
    const out = await resolveActAs(req({ cookie: 'tg_session=abc', 'x-tg-act-as': 'grant' }));
    expect(out.kind).toBe('invalid');
  });

  it('is "invalid" when Control cannot be reached', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const out = await resolveActAs(req({ cookie: 'tg_session=abc', 'x-tg-act-as': 'grant' }));
    expect(out.kind).toBe('invalid');
  });

  it('is "invalid" when a grant arrives with no session cookie to check it against', async () => {
    const out = await resolveActAs(req({ 'x-tg-act-as': 'grant' }));
    expect(out.kind).toBe('invalid');
  });

  it('ignores whitespace-only header values', async () => {
    expect(await resolveActAs(req({ cookie: 'x=1', 'x-tg-act-as': '   ' }))).toEqual({ kind: 'none' });
  });
});

describe('requireAgency', () => {
  it('falls back to the cookie when nobody is acting', async () => {
    const token = await signAgencySession({
      agencyId: 'recRCZl6afFpBFSW6',
      email: 'andy.speight@agendas.group',
    });

    const claims = await requireAgency(req({ cookie: `lt_agency_session=${token}` }));
    expect(claims?.agencyId).toBe('recRCZl6afFpBFSW6');
  });

  it('REFUSES rather than falling back when a presented grant is refused', async () => {
    // The incident, exactly: a perfectly good agency cookie of the staff
    // member's own, plus a grant that has expired. The old code answered with
    // the cookie's agency and the invite went to the wrong place. It must now
    // fail the request instead, so the portal shows an error the staff member
    // can see and correct.
    control({ ok: false }, 401);

    const token = await signAgencySession({
      agencyId: 'recRCZl6afFpBFSW6',
      email: 'andy.speight@agendas.group',
    });

    const claims = await requireAgency(
      req({ cookie: `lt_agency_session=${token}`, 'x-tg-act-as': 'expired-grant' }),
    );

    expect(claims).toBeNull();
  });

  it('uses the acted-as agency, with the real person as the actor', async () => {
    control(STAFF_OK);

    const token = await signAgencySession({
      agencyId: 'recRCZl6afFpBFSW6',
      email: 'andy.speight@agendas.group',
    });

    const claims = await requireAgency(
      req({ cookie: `lt_agency_session=${token}`, 'x-tg-act-as': 'grant' }),
    );

    // The client's agency wins over the staff member's own cookie…
    expect(claims?.agencyId).toBe('recRA6kkeuHKY7acT');
    // …while everything written stays attributable to the human being.
    expect(claims?.email).toBe('andy@travelgenix.io');
    expect(claims?.actingAs?.agencyName).toBe('Your Ticket Genie');
  });
});

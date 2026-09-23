/**
 * The Pay route, with the session, the database and Control faked.
 *
 * What matters is whose booking a payment page is opened for, and what is
 * handed back to the phone. The booking must come from the signed-in
 * traveller's own record and never from the request; the only thing handed
 * back is an https page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const verifySession = vi.fn();
vi.mock('@/lib/jwt', () => ({ verifySession: (t: string) => verifySession(t) }));

let travellerRow: Record<string, unknown> | null;
vi.mock('@/lib/supabase', () => ({
  checkSupabaseEnv: () => null,
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: travellerRow, error: null }) }),
      }),
    }),
  }),
}));

let controlReply: { status: number; body: unknown };
const controlCalls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  controlCalls.push({
    url: String(url),
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  return new Response(JSON.stringify(controlReply.body), { status: controlReply.status });
}) as typeof fetch;

process.env.TG_INTERNAL_KEY = 'test-internal-key';
const { POST } = await import('@/app/api/traveller/pay/route');

const ROW = {
  agency_id: 'recABCDEFGHIJKLMN',
  booking_ref: 'CYPHTR-120964',
  email: 'lead@example.com',
  departure_date: '2026-10-22',
};

function req(body: unknown, cookie = 'lt_session=signed') {
  return new NextRequest('https://my-booking.co/api/traveller/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  verifySession.mockReset();
  verifySession.mockResolvedValue({ travellerId: 't-1', agencyId: ROW.agency_id, bookingRef: ROW.booking_ref });
  travellerRow = { ...ROW };
  controlReply = { status: 200, body: { ok: true, url: 'https://pay.agency.example/basket/1', payment: { amount: 1672, currency: 'GBP' } } };
  controlCalls.length = 0;
});

describe('POST /api/traveller/pay', () => {
  it('refuses anybody who is not signed in, and never reaches Control', async () => {
    expect((await POST(req({}, ''))).status).toBe(401);
    verifySession.mockResolvedValue(null);
    expect((await POST(req({}))).status).toBe(401);
    expect(controlCalls).toHaveLength(0);
  });

  it('returns the payment page for the traveller’s own booking', async () => {
    const res = await POST(req({ amount: 1672 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, url: 'https://pay.agency.example/basket/1', amount: 1672 });
    expect(controlCalls[0].url).toBe('https://id.travelify.io/api/internal/pay-balance-by-client');
    expect(controlCalls[0].headers['X-TG-Internal-Key']).toBe('test-internal-key');
    expect(controlCalls[0].body).toEqual({
      recordId: ROW.agency_id,
      orderRef: ROW.booking_ref,
      emailAddress: ROW.email,
      departDate: ROW.departure_date,
      amount: 1672,
    });
  });

  // The attack this route exists to rule out.
  it('ignores any booking details in the request and uses the traveller’s own', async () => {
    await POST(req({ amount: 10, orderRef: 'SOMEONE-ELSE', emailAddress: 'x@y.z', recordId: 'recZZZZZZZZZZZZZZ' }));
    expect(controlCalls[0].body).toMatchObject({ orderRef: ROW.booking_ref, emailAddress: ROW.email, recordId: ROW.agency_id });
  });

  it('lets Control decide the amount when none is sent', async () => {
    await POST(req({}));
    expect('amount' in controlCalls[0].body).toBe(false);
  });

  it('refuses a nonsense amount before it goes anywhere', async () => {
    for (const amount of [-5, 0, '1672', 12.345, 1e9]) {
      expect((await POST(req({ amount }))).status, String(amount)).toBe(400);
    }
    expect(controlCalls).toHaveLength(0);
  });

  it('only pays against a Travelify booking', async () => {
    travellerRow = { ...ROW, agency_id: 'ltABCDEFGHIJKLMN' };
    expect((await POST(req({}))).status).toBe(404);
    expect(controlCalls).toHaveLength(0);
  });

  it('never hands the phone anything but an https page', async () => {
    controlReply = { status: 200, body: { ok: true, url: 'http://insecure.example/basket' } };
    const res = await POST(req({}));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('insecure');
  });

  it('says so when there is nothing left to pay', async () => {
    controlReply = { status: 200, body: { ok: false, noBalance: true } };
    const res = await POST(req({}));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'no_balance' });
  });

  it('says the balance changed when Control refuses the amount', async () => {
    controlReply = { status: 400, body: { error: 'invalid_amount', message: 'That’s more than the balance' } };
    const res = await POST(req({ amount: 3344 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'balance_changed' });
  });

  it('passes on nothing of Control’s own errors', async () => {
    controlReply = { status: 502, body: { error: 'upstream', detail: 'secret stack' } };
    const res = await POST(req({}));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'unavailable' });
  });
});

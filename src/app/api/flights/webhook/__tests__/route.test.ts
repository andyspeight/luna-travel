/**
 * The flight webhook, end to end, with the database and the push service faked.
 *
 * This exists for one reason. The webhook shipped writing a message row and
 * nothing else, so a cancellation at 2am waited politely in the app until
 * somebody opened it. Everything needed to wake the phone was already
 * built — VAPID keys, the service worker, sendPushToTravellers — and simply
 * never called. No unit test could catch that, because each piece was fine on
 * its own; only the seam was missing.
 *
 * So these tests assert the seam: a meaningful change sends, a quiet tick does
 * not, and the payload is the one a traveller should get.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fakes ────────────────────────────────────────────────────────────────────

const sendPushToTravellers = vi.fn(async () => ({ sent: 1 }));
vi.mock('@/lib/push', () => ({
  sendPushToTravellers: (...args: unknown[]) =>
    (sendPushToTravellers as unknown as (...a: unknown[]) => Promise<{ sent: number }>)(...args),
}));

type Row = Record<string, unknown>;

/** Whatever the route asks each table for. Enough chaining to satisfy it. */
const tables: Record<string, Row[]> = {};
const writes: Array<{ table: string; op: string; payload: unknown }> = [];

class Query {
  private ops: string[] = [];
  private payload: unknown = null;
  constructor(private table: string) {}
  select() { this.ops.push('select'); return this; }
  eq() { return this; }
  in() { return this; }
  single() { this.ops.push('single'); return this; }
  update(v: unknown) { this.ops.push('update'); this.payload = v; return this; }
  insert(v: unknown) { this.ops.push('insert'); this.payload = v; return this; }
  delete() { this.ops.push('delete'); return this; }
  then(resolve: (r: unknown) => unknown) {
    const write = this.ops.find((o) => o === 'update' || o === 'insert' || o === 'delete');
    if (write) {
      writes.push({ table: this.table, op: write, payload: this.payload });
      // An insert that is read back (messages) must hand an id back.
      if (write === 'insert' && this.ops.includes('single')) {
        return Promise.resolve({ data: { id: 'msg-1' }, error: null }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    }
    const rows = tables[this.table] ?? [];
    const data = this.ops.includes('single') ? rows[0] ?? null : rows;
    return Promise.resolve({ data, error: null }).then(resolve);
  }
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => new Query(t) }),
}));

const TOKEN = 'test-webhook-token';
process.env.AERODATABOX_WEBHOOK_TOKEN = TOKEN;

const { POST } = await import('@/app/api/flights/webhook/route');

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A watched leg sitting at Scheduled with no gate yet. */
function watchedLeg(over: Row = {}): Row {
  return {
    id: 'tf-1',
    agency_id: 'recAgency1',
    booking_ref: 'YTG58405',
    flight_leg_id: 'leg-out',
    carrier_code: 'BA',
    flight_number: '852',
    status_code: 'Scheduled',
    dep_gate: null,
    dep_terminal_live: null,
    baggage_belt: null,
    ...over,
  };
}

function callback(flight: Row) {
  return new Request(`https://example.test/api/flights/webhook?t=${TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: { id: 'sub-1' }, flights: [flight] }),
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const post = (req: Request) => POST(req as any);

beforeEach(() => {
  sendPushToTravellers.mockClear();
  writes.length = 0;
  tables.trip_flights = [watchedLeg()];
  tables.travellers = [{ id: 'trav-1' }, { id: 'trav-2' }];
  tables.agencies = [{ id: 'recAgency1', name: 'Your Ticket Genie' }];
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('flight webhook auth', () => {
  it('refuses a callback with the wrong token', async () => {
    const res = await post(
      new Request('https://example.test/api/flights/webhook?t=wrong', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(res.status).toBe(403);
    expect(sendPushToTravellers).not.toHaveBeenCalled();
  });
});

describe('flight webhook notifications', () => {
  it('wakes every traveller on the booking when a flight is cancelled', async () => {
    const res = await post(callback({ status: 'Canceled' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, messaged: 1 });
    expect(sendPushToTravellers).toHaveBeenCalledTimes(1);

    const [ids, payload] = sendPushToTravellers.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(ids).toEqual(['trav-1', 'trav-2']);
    expect(payload).toMatchObject({
      title: 'Your Ticket Genie',
      url: '/flight/leg-out',
      tag: 'flight-leg-out',
      urgent: true,
    });
    expect(payload.body).toContain('cancelled');
  });

  it('sends the message row AND the push, not one or the other', async () => {
    await post(callback({ status: 'Canceled' }));
    const inserted = writes.filter((w) => w.op === 'insert').map((w) => w.table);
    expect(inserted).toEqual(['messages', 'message_recipients']);
    expect(sendPushToTravellers).toHaveBeenCalled();
  });

  it('stays silent on a tick that changes nothing', async () => {
    tables.trip_flights = [watchedLeg({ status_code: 'Scheduled' })];
    const res = await post(callback({ status: 'Expected' })); // Expected -> Scheduled
    const body = await res.json();

    expect(body).toMatchObject({ messaged: 0, pushed: 0 });
    expect(sendPushToTravellers).not.toHaveBeenCalled();
    // It still keeps the card fresh, so the in-app view is never stale.
    expect(writes.some((w) => w.table === 'trip_flights' && w.op === 'update')).toBe(true);
  });

  it('notifies a gate assignment, and names the gate', async () => {
    const res = await post(
      callback({ status: 'Boarding', departure: { gate: '22' } }),
    );
    expect((await res.json()).messaged).toBe(1);
    const [, payload] = sendPushToTravellers.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(payload.body).toBe('BA852 is boarding at gate 22.');
  });

  it('does not buzz through a lock screen for an ordinary update', async () => {
    await post(callback({ status: 'Arrived' }));
    const [, payload] = sendPushToTravellers.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(payload.urgent).toBe(false);
  });

  it('still sends when the agency name cannot be resolved', async () => {
    tables.agencies = []; // a Control agency has no row here
    await post(callback({ status: 'Canceled' }));
    const [, payload] = sendPushToTravellers.mock.calls[0] as unknown as [string[], Record<string, unknown>];
    expect(payload.title).toBe('Your travel agent');
  });

  it('does nothing at all when no trip is watching that subscription', async () => {
    tables.trip_flights = [];
    const res = await post(callback({ status: 'Canceled' }));
    expect(await res.json()).toMatchObject({ ok: true, note: 'no matching trips' });
    expect(sendPushToTravellers).not.toHaveBeenCalled();
  });

  it('reaches both bookings when two share one flight', async () => {
    tables.trip_flights = [
      watchedLeg(),
      watchedLeg({ id: 'tf-2', booking_ref: 'ABC12345', flight_leg_id: 'leg-other' }),
    ];
    const res = await post(callback({ status: 'Canceled' }));
    expect((await res.json()).messaged).toBe(2);
    expect(sendPushToTravellers).toHaveBeenCalledTimes(2);

    // Separate bookings must not collapse onto one another's notification.
    const tags = sendPushToTravellers.mock.calls.map(
      (c) => (c as unknown as [string[], Record<string, unknown>])[1].tag,
    );
    expect(new Set(tags).size).toBe(2);
  });
});

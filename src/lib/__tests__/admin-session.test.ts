import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAdminSession, verifyAdminSession, signInUrl } from '@/lib/admin-session';

/**
 * Why an admin cannot get in, told apart.
 *
 * These four outcomes used to collapse into one `null`, and the admin screen
 * turned all of them into "Your session has expired — please sign in again."
 * For a missing permission that is false: signing in again produces the
 * identical message, for ever. Somebody hit that loop two weeks running before
 * anyone realised the sentence was wrong rather than the session.
 */

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const control = (status: number, body: unknown) => {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  ) as unknown as typeof fetch;
};

const withPermission = {
  ok: true,
  user: { email: 'jess@agendas.group' },
  permissions: [{ product: 'luna_travel', role: 'admin' }],
};

const withoutPermission = {
  ok: true,
  user: { email: 'jess@agendas.group' },
  permissions: [{ product: 'travelify', role: 'admin' }],
};

describe('signed out', () => {
  it('says so when there is no cookie at all', async () => {
    expect((await checkAdminSession(null)).state).toBe('signed-out');
    expect((await checkAdminSession('')).state).toBe('signed-out');
  });

  it('says so when Travelgenix ID rejects the session', async () => {
    control(401, {});
    expect((await checkAdminSession('tg_session=stale')).state).toBe('signed-out');
  });

  it('says so when the response is not a success envelope', async () => {
    control(200, { ok: false });
    expect((await checkAdminSession('tg_session=x')).state).toBe('signed-out');
  });

  it('says so when there is no email to attribute anything to', async () => {
    control(200, { ok: true, user: {}, permissions: [] });
    expect((await checkAdminSession('tg_session=x')).state).toBe('signed-out');
  });
});

describe('signed in, but not for this product', () => {
  // THE case. Real person, real session, no luna_travel.
  it('is reported separately from being signed out', async () => {
    control(200, withoutPermission);
    const r = await checkAdminSession('tg_session=x');

    expect(r.state).toBe('no-permission');
    if (r.state !== 'no-permission') return;
    // The email matters: the screen names the account, so somebody signed in
    // as the wrong one can see that at a glance.
    expect(r.email).toBe('jess@agendas.group');
  });

  it('is not fooled by holding a permission on some other product', async () => {
    control(200, { ok: true, user: { email: 'a@b.c' }, permissions: [{ product: 'luna_chat', role: 'owner' }] });
    expect((await checkAdminSession('tg_session=x')).state).toBe('no-permission');
  });
});

describe('our problem, not theirs', () => {
  // Telling somebody to sign in again because Control blipped sends them
  // round a loop that cannot possibly help.
  it('distinguishes an unreachable Control from a bad session', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    expect((await checkAdminSession('tg_session=x')).state).toBe('unavailable');
  });

  it('treats a 500 from Control as unavailable, not as signed out', async () => {
    control(500, {});
    expect((await checkAdminSession('tg_session=x')).state).toBe('unavailable');
  });

  it('treats unreadable JSON as unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html>oops', { status: 200 })) as unknown as typeof fetch;
    expect((await checkAdminSession('tg_session=x')).state).toBe('unavailable');
  });
});

describe('the happy path still works', () => {
  it('returns claims for a valid session holding luna_travel', async () => {
    control(200, withPermission);
    const r = await checkAdminSession('tg_session=good');

    expect(r.state).toBe('ok');
    if (r.state !== 'ok') return;
    expect(r.claims.email).toBe('jess@agendas.group');
    expect(r.claims.role).toBe('admin');
  });
});

describe('verifyAdminSession is unchanged for every existing caller', () => {
  // The gates only ever wanted claims-or-nothing. Changing that would have
  // meant touching the middleware and every route at once.
  it('still returns claims on success', async () => {
    control(200, withPermission);
    expect((await verifyAdminSession('tg_session=good'))?.email).toBe('jess@agendas.group');
  });

  it('still returns null for every failure, whatever the reason', async () => {
    control(200, withoutPermission);
    expect(await verifyAdminSession('tg_session=x')).toBeNull();

    control(401, {});
    expect(await verifyAdminSession('tg_session=x')).toBeNull();

    expect(await verifyAdminSession(null)).toBeNull();
  });
});

describe('signInUrl', () => {
  it('sends them to Travelgenix ID and brings them back', () => {
    const url = signInUrl('https://lunatravel.travelify.io/admin/heroes');
    expect(url.startsWith('https://id.travelify.io/signin')).toBe(true);
    expect(url).toContain(encodeURIComponent('https://lunatravel.travelify.io/admin/heroes'));
  });

  it('escapes a return address carrying its own query string', () => {
    const url = signInUrl('https://x.co/admin?tab=a&b=c');
    // Unescaped, the &b=c would become a parameter of the sign-in page.
    expect(url).not.toContain('&b=c');
    expect(url).toContain('%26b%3Dc');
  });
});

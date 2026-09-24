import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The manifest a phone reads before any script has run. A signed-in
 * traveller gets their agency's app; anybody else, and anything unreadable,
 * the neutral default, never an error.
 */

let session: { travellerId: string } | null = null;
let savedIdentity: unknown = null;
vi.mock('@/lib/jwt', () => ({ verifySession: async () => session }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { app_identity: savedIdentity } }) }) }),
    }),
  }),
}));

import { GET } from '../route';
import { identityOf } from '@/lib/app-icon';

const call = (cookie?: string) =>
  GET(new NextRequest('https://my-booking.co/api/app/manifest/current', { headers: cookie ? { cookie } : {} }));

beforeEach(() => {
  session = null;
  savedIdentity = null;
});

describe('GET /api/app/manifest/current', () => {
  it('gives a signed-in traveller their agency’s app', async () => {
    session = { travellerId: 't1' };
    savedIdentity = JSON.parse(JSON.stringify(identityOf({ appName: 'Sunseekers', brandPrimaryColour: '#0e7490' })));
    const res = await call('lt_session=token');
    const m = await res.json();
    expect(m.name).toBe('Sunseekers');
    expect(m.theme_color).toBe('#0e7490');
    expect(m.icons[0].src).toMatch(/l=S/);
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(res.headers.get('content-type')).toBe('application/manifest+json');
  });

  it('gives anybody else the neutral default', async () => {
    const m = await (await call()).json();
    expect(m.name).toBe('Your trip');
    expect(JSON.stringify(m)).not.toMatch(/Luna/);
  });

  it('falls back to the default, never an error, when what is saved cannot be read', async () => {
    session = { travellerId: 't1' };
    savedIdentity = { name: 'X', spec: { primary: 'not a colour' } };
    const res = await call('lt_session=token');
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('Your trip');
  });
});

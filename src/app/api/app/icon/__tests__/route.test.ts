import { describe, it, expect, vi, afterEach } from 'vitest';

// Which icons agencies have saved on App branding.
const saved = new Set<string>();
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, url: string) => ({ limit: async () => ({ data: saved.has(url) ? [{ agency_id: 'recA' }] : [] }) }),
      }),
    }),
  }),
}));

import { GET } from '../route';
import { iconSpecFor, iconUrl } from '@/lib/app-icon';

/**
 * The icon is drawn for real here, and the PNG checked for its size: a
 * manifest that declares 512 × 512 and serves anything else is not
 * installable.
 */

const ICON = 'https://abc123xyz.public.blob.vercel-storage.com/agency-icons/recAAAAAAAAAAAAAA-1-icon.png';

// A 1 × 1 red PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

const call = (path: string) => GET(new Request(`https://my-booking.co${path}`));

async function png(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer());
  return { sig: buf.subarray(1, 4).toString(), width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  saved.clear();
});

describe('GET /api/app/icon', () => {
  it('draws the letter icon at the size asked for', async () => {
    for (const size of [180, 192, 512] as const) {
      const res = await call(iconUrl(iconSpecFor({ appName: 'Sunseekers' }), size));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(await png(res)).toEqual({ sig: 'PNG', width: size, height: size });
    }
  });

  it('draws the agency’s own icon, fetched only from our store', async () => {
    saved.add(ICON);
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      fetched.push(String(u));
      return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    });
    const res = await call(iconUrl(iconSpecFor({ name: 'X', iconUrl: ICON }), 192));
    expect(res.status).toBe(200);
    expect(fetched).toEqual([ICON]);
    expect(res.headers.get('cache-control')).toMatch(/immutable/);
  });

  it('never fetches an image nobody saved, even one shaped like ours', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      fetched.push(String(u));
      return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    });
    const res = await call(iconUrl(iconSpecFor({ name: 'X', iconUrl: ICON }), 192));
    expect(res.status).toBe(200);
    expect(fetched).toEqual([]);
    expect(res.headers.get('cache-control')).toMatch(/max-age=300/);
  });

  it('draws the letter, and caches it briefly, when the upload cannot be read', async () => {
    saved.add(ICON);
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));
    const res = await call(iconUrl(iconSpecFor({ name: 'X', iconUrl: ICON }), 192));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/max-age=300/);
  });

  it('refuses a request it did not write', async () => {
    const res = await call('/api/app/icon?s=192&p=0e7490&a=f59e0b&u=https%3A%2F%2Fevil.example%2Fagency-icons%2Fx.png');
    expect(res.status).toBe(400);
  });
});

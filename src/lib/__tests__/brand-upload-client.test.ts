import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A logo upload from the portal failed with "The upload did not go through"
 * for a Travelgenix staff member acting as a client (24 Sep 2026). The log
 * said "Invalid upload path": the upload library had kept its own copy of
 * fetch from before the portal wrapped it with the "acting as" header, so the
 * token request went out as the staff member's own agency.
 *
 * These run the portal's order of events: the upload code loads first, the
 * acting-as wrapper is installed afterwards.
 */

vi.mock('@vercel/blob/client', () => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://abc.public.blob.vercel-storage.com/${pathname}` })),
}));

const ORIGIN = 'https://my-booking.co';
const PATH = 'agency-logos/recDASZoxTTCSXSjH-1-logo.png';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

let sent: Array<{ url: string; headers: Headers; body: Record<string, unknown> }>;
let reply: { status: number; body: unknown };

beforeEach(() => {
  vi.clearAllMocks();
  sent = [];
  reply = { status: 200, body: { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_x' } };
  const baseFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  vi.stubGlobal('fetch', baseFetch);
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', { location: { origin: ORIGIN }, get fetch() { return globalThis.fetch; }, set fetch(f) { globalThis.fetch = f; } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('uploading a logo while acting as a client', () => {
  it('asks for the upload token with the acting-as header', async () => {
    // 1. The upload code loads with the page...
    const { uploadBrandImage } = await import('@/lib/brand-upload-client');
    // 2. ...and only then does the portal start acting and wrap fetch.
    const { installActAsFetch } = await import('@/lib/act-as-client');
    sessionStorage.setItem(
      'luna-travel.act-as',
      JSON.stringify({ grant: 'grant-123', agencyId: 'recDASZoxTTCSXSjH', agencyName: 'Client', expiresAt: Date.now() + 60_000 }),
    );
    installActAsFetch();

    const url = await uploadBrandImage(PATH, { type: 'image/png' } as File);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(`${ORIGIN}/api/agency/upload-image`);
    expect(sent[0].headers.get('x-tg-act-as')).toBe('grant-123');
    expect(sent[0].body).toMatchObject({ type: 'blob.generate-client-token', payload: { pathname: PATH } });
    expect(url).toContain(PATH);
  });

  it('says why when the route refuses', async () => {
    const { uploadBrandImage, UploadRefused } = await import('@/lib/brand-upload-client');
    reply = { status: 400, body: { error: 'upload_refused' } };
    await expect(uploadBrandImage(PATH, { type: 'image/png' } as File)).rejects.toBeInstanceOf(UploadRefused);
    await expect(uploadBrandImage(PATH, { type: 'image/png' } as File)).rejects.toMatchObject({ code: 'upload_refused' });
  });

  it('never sends the file when there is no token', async () => {
    const { put } = await import('@vercel/blob/client');
    const { uploadBrandImage } = await import('@/lib/brand-upload-client');
    reply = { status: 200, body: {} };
    await expect(uploadBrandImage(PATH, { type: 'image/png' } as File)).rejects.toMatchObject({ code: 'no_token' });
    expect(put).not.toHaveBeenCalled();
  });
});

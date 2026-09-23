import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The branding upload route. The token request needs an agency session; the
 * path it signs must be inside that agency's folder.
 */

const requireAgency = vi.fn();
vi.mock('@/lib/agency-session', () => ({ requireAgency: (r: Request) => requireAgency(r) }));

let lastPath: string | null = null;
vi.mock('@vercel/blob/client', () => ({
  handleUpload: async (opts: { body: { payload?: { pathname?: string } }; onBeforeGenerateToken: (p: string) => Promise<unknown> }) => {
    lastPath = opts.body.payload?.pathname ?? '';
    await opts.onBeforeGenerateToken(lastPath);
    return { type: 'blob.generate-client-token', clientToken: 'signed' };
  },
}));

process.env.BLOB_READ_WRITE_TOKEN = 'test';
const { POST } = await import('@/app/api/agency/upload-image/route');

const MINE = 'recABCDEFGHIJKLMN';
const tokenRequest = (pathname: string) =>
  new Request('https://lunatravel.travelify.io/api/agency/upload-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname, callbackUrl: 'x' } }),
  });
/* eslint-disable @typescript-eslint/no-explicit-any */
const post = (r: Request) => POST(r as any);

beforeEach(() => {
  requireAgency.mockReset();
  lastPath = null;
});

describe('POST /api/agency/upload-image', () => {
  it('refuses a token to anyone without an agency session', async () => {
    requireAgency.mockResolvedValue(null);
    const res = await post(tokenRequest(`agency-logos/${MINE}-1-logo.png`));
    expect(res.status).toBe(401);
    expect(lastPath).toBeNull();
  });

  it('signs an upload into the agency’s own folder', async () => {
    requireAgency.mockResolvedValue({ agencyId: MINE });
    const res = await post(tokenRequest(`agency-logos/${MINE}-1-logo.png`));
    expect(res.status).toBe(200);
  });

  it("refuses to sign an upload into another agency's folder", async () => {
    requireAgency.mockResolvedValue({ agencyId: MINE });
    const res = await post(tokenRequest('agency-logos/recZZZZZZZZZZZZZZ-1-logo.png'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'upload_refused' });
  });
});

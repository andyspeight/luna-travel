/**
 * POST /api/admin/agencies/[id]/upload-logo
 *
 * Mints a short-lived Vercel Blob client-upload token so the Branding tab can
 * upload an agency logo DIRECTLY from the browser to Blob storage — the same
 * pattern as the widgets' /api/upload-pdf (the file never routes through this
 * function, so it bypasses Vercel's 4.5MB body limit).
 *
 * Writes to luna-travel's own PUBLIC Blob store (resolves via
 * BLOB_READ_WRITE_TOKEN). The store must be public, not private: logos have to
 * be readable without a token so they can render on the white-label app, and a
 * private store rejects public uploads outright. Files are scoped under the
 * `agency-logos/` prefix.
 *
 * Auth: the initial token request is gated by requireAdmin (luna_travel admin,
 * same-origin tg_session cookie rides along — the Blob SDK can't set a custom
 * Authorization header). The upload-completed webhook from Vercel carries no
 * cookie and is verified cryptographically by handleUpload, so it is NOT gated.
 *
 * The resulting URL is persisted to Control's Clients.logoUrl via the branding
 * save flow — this route only handles the upload, not persistence.
 *
 * Note: SVG is deliberately NOT allowed. Because the file streams straight to
 * Blob and never passes through this function, we cannot sanitise it, and a
 * public SVG URL can execute embedded script if opened directly. Raster formats
 * only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — plenty for a logo
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[upload-logo] BLOB_READ_WRITE_TOKEN not set');
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Only the browser's token request is gated. The Vercel upload-completed
  // webhook (type === 'blob.upload-completed') carries no cookie and is
  // verified by handleUpload itself, so don't gate that one.
  const bodyType = (body as { type?: string } | null)?.type;
  if (bodyType === 'blob.generate-client-token') {
    const claims = await requireAdmin(req as unknown as Request);
    if (!claims) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    const cookieHeader = req.headers.get('cookie') ?? '';
    if (!cookieHeader.includes(ADMIN_COOKIE_NAME)) {
      return NextResponse.json({ error: 'no_session_cookie' }, { status: 401 });
    }
  }

  const agencyId = (params?.id || '').trim();

  try {
    const jsonResponse = await handleUpload({
      body: body as Parameters<typeof handleUpload>[0]['body'],
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Logos only, under agency-logos/, within the size cap.
        if (typeof pathname !== 'string' || pathname.indexOf('agency-logos/') !== 0) {
          throw new Error('Invalid upload path');
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_LOGO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ agencyId }),
        };
      },
      // No server-side post-processing: the Branding tab stores the returned
      // URL and saves it to Control on Save. No-op.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse, { status: 200 });
  } catch (err) {
    const msg = (err as Error)?.message || 'Upload failed';
    console.error('[upload-logo] handleUpload failed:', msg);
    const status = /path|content type|size|token/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

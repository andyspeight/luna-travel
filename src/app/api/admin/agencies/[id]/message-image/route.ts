/**
 * POST /api/admin/agencies/[id]/message-image
 *
 * Mints a short-lived Vercel Blob client-upload token so the message composer
 * can upload an image DIRECTLY from the browser to Blob storage. The file never
 * routes through this function, so it bypasses Vercel's 4.5MB body limit. Same
 * pattern and same PUBLIC Blob store as upload-logo (resolves via
 * BLOB_READ_WRITE_TOKEN). Files are scoped under the `message-images/` prefix so
 * they sit apart from agency logos.
 *
 * Auth: the browser's token request is gated by requireAdmin (luna_travel admin,
 * same-origin tg_session cookie rides along). The Vercel upload-completed webhook
 * carries no cookie and is verified cryptographically by handleUpload, so it is
 * NOT gated.
 *
 * SVG is deliberately NOT allowed. The file streams straight to Blob and never
 * passes through this function, so it cannot be sanitised, and a public SVG URL
 * can execute embedded script if opened directly. Raster formats only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[message-image] BLOB_READ_WRITE_TOKEN not set');
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Only the browser's token request is gated. The Vercel upload-completed
  // webhook (type === 'blob.upload-completed') carries no cookie and is verified
  // by handleUpload itself, so don't gate that one.
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
        // Message images only, under message-images/, within the size cap.
        if (typeof pathname !== 'string' || pathname.indexOf('message-images/') !== 0) {
          throw new Error('Invalid upload path');
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ agencyId }),
        };
      },
      // No server-side post-processing: the composer keeps the returned URL and
      // sends it with the message. No-op.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse, { status: 200 });
  } catch (err) {
    const msg = (err as Error)?.message || 'Upload failed';
    console.error('[message-image] handleUpload failed:', msg);
    const status = /path|content type|size|token/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

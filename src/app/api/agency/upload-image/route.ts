/**
 * POST /api/agency/upload-image
 *
 * Lets a signed-in agency upload its own logo, or its home-screen icon, from
 * the App branding screen. That screen asked for a pasted logo URL — "File
 * upload is coming soon" — which is no use to an agent whose logo is a file on
 * their laptop.
 *
 * The same client-upload pattern as the admin logo route
 * (/api/admin/agencies/[id]/upload-logo): this function only mints a short-lived
 * Vercel Blob token, and the file goes straight from the browser to the public
 * Blob store, so Vercel's 4.5MB body limit never applies. The resulting URL is
 * saved by the branding form's Save button, not here.
 *
 * Auth: the token request needs the agency's session (lt_agency_session, or a
 * staff act-as grant). The agency comes from that session and the upload path
 * must be inside that agency's own folder, so one agency cannot write into
 * another's. The upload-completed callback from Vercel carries no cookie; it is
 * verified cryptographically by handleUpload, so it is not gated here. /api/agency
 * is not behind the edge middleware, so nothing else stands in its way.
 *
 * Raster images only. SVG is refused for the same reason as the admin route:
 * the file never passes through this function to be sanitised, and a public SVG
 * can run script when opened directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { requireAgency } from '@/lib/agency-session';
import { isOwnBrandPath, BRAND_FOLDERS, BRAND_IMAGE_TYPES, BRAND_IMAGE_MAX_BYTES } from '@/lib/brand-upload';
import { ICON_IMAGE_TYPES } from '@/lib/app-icon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[agency/upload-image] BLOB_READ_WRITE_TOKEN not set');
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Only the browser's token request is gated; the completion callback is
  // Vercel's own, signed, and carries no session.
  let agencyId = '';
  if ((body as { type?: string } | null)?.type === 'blob.generate-client-token') {
    const claims = await requireAgency(req as unknown as Request);
    if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    agencyId = claims.agencyId;
  }

  try {
    const jsonResponse = await handleUpload({
      body: body as Parameters<typeof handleUpload>[0]['body'],
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname: string) => {
        if (!isOwnBrandPath(pathname, agencyId)) throw new Error('Invalid upload path');
        return {
          // The icon renderer reads PNG and JPEG only.
          allowedContentTypes: pathname.startsWith(`${BRAND_FOLDERS.icon}/`) ? ICON_IMAGE_TYPES : BRAND_IMAGE_TYPES,
          maximumSizeInBytes: BRAND_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ agencyId }),
        };
      },
      // Nothing to do on completion: the form saves the URL with Save branding.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse, { status: 200 });
  } catch (err) {
    const msg = (err as Error)?.message || 'Upload failed';
    console.error('[agency/upload-image] handleUpload failed:', msg);
    const status = /path|content type|size|token/i.test(msg) ? 400 : 500;
    // Generic to the browser; the detail is in the log.
    return NextResponse.json({ error: status === 400 ? 'upload_refused' : 'upload_failed' }, { status });
  }
}

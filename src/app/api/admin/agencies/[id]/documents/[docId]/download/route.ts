/**
 * GET /api/admin/agencies/[id]/documents/[docId]/download
 *
 * Returns a short-lived signed URL for the underlying storage object.
 * The admin can use this to preview or download the document.
 *
 * URL is valid for 5 minutes — plenty for a single browser fetch.
 *
 * Admin-gated (middleware).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'luna-travel-documents';
const SIGN_VALIDITY_SECONDS = 5 * 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const agencyId = params.id;
  const docId = params.docId;
  if (!agencyId || !docId) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Look up the doc; verify ownership and that it's not deleted
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, agency_id, storage_path, filename, mime_type, deleted_at')
    .eq('id', docId)
    .eq('agency_id', agencyId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (doc.deleted_at) {
    return NextResponse.json({ error: 'deleted' }, { status: 410 });
  }

  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, SIGN_VALIDITY_SECONDS, {
      download: doc.filename as string,
    });

  if (signErr || !signed?.signedUrl) {
    console.error('[documents.download] sign failed:', signErr?.message);
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    filename: doc.filename,
    mimeType: doc.mime_type,
    expiresInSeconds: SIGN_VALIDITY_SECONDS,
  });
}

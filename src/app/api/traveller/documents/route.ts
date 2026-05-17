/**
 * GET /api/traveller/documents
 *
 * Returns the documents for the traveller identified by the lt_session cookie.
 * Each document includes a short-lived signed URL the PWA can use to display
 * or download the file.
 *
 * Public endpoint (not behind the admin middleware). Auth happens via the
 * session cookie that's set when the invite was redeemed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';
const BUCKET = 'luna-travel-documents';
const SIGN_VALIDITY_SECONDS = 15 * 60; // 15 mins — long enough for the PWA to use the URL even after some delay

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch the documents for this traveller
  const { data, error } = await supabase
    .from('documents')
    .select('id, storage_path, filename, mime_type, size_bytes, category, uploaded_at')
    .eq('traveller_id', claims.travellerId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[traveller.documents]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  // Build signed URLs for each document. createSignedUrls is a single batch call.
  const rows = data || [];
  const paths = rows.map((r) => r.storage_path as string);

  let urlMap: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed, error: signErr } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGN_VALIDITY_SECONDS);

    if (signErr) {
      console.error('[traveller.documents] sign failed:', signErr.message);
      return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
    }
    for (const item of signed || []) {
      if (item.path && item.signedUrl) {
        urlMap[item.path] = item.signedUrl;
      }
    }
  }

  return NextResponse.json({
    documents: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      category: r.category,
      uploadedAt: r.uploaded_at,
      url: urlMap[r.storage_path as string] || null,
    })),
    signValidityMs: SIGN_VALIDITY_SECONDS * 1000,
  });
}

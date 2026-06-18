/**
 * POST /api/admin/agencies/[id]/booking-photo  (multipart: { file })
 *
 * Uploads a single product photo for an off-platform booking to the public
 * `booking-photos` bucket and returns its public URL, which the Add-booking
 * form attaches to a hotel/experience. Admin-gated. Images only, 8 MB cap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'booking-photos';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'image/avif': 'avif',
};
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const agencyId = (params?.id || '').trim();
  if (!REC_ID_RE.test(agencyId)) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'file_empty' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', message: 'Maximum 8 MB' }, { status: 400 });
  const mime = file.type || '';
  const ext = ALLOWED[mime];
  if (!ext) return NextResponse.json({ error: 'unsupported_type', message: 'Images only (JPG, PNG, WEBP, HEIC)' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const path = `${agencyId}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) {
    console.error('[booking-photo] upload failed:', error.message);
    return NextResponse.json({ error: 'upload_failed', message: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

/**
 * /api/agency/documents — the signed-in agency's traveller documents. agencyId
 * always comes from the session; documents are attached to a BOOKING REF (so an
 * agency can upload vouchers/tickets before the traveller has redeemed). If a
 * traveller has already redeemed that booking we also link the traveller_id.
 *
 *   GET  — list this agency's documents (newest first), grouped by booking.
 *   POST — multipart { file, bookingRef, category? }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { categoriseFromFilename, type DocumentCategory } from '@/lib/categorise-document';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'luna-travel-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const CATEGORIES: DocumentCategory[] = ['voucher', 'ticket', 'itinerary', 'insurance', 'other'];

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('id, booking_ref, traveller_id, filename, mime_type, size_bytes, category, uploaded_at')
    .eq('agency_id', claims.agencyId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[agency/documents] list failed', error.message);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }

  const documents = ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    id: d.id,
    bookingRef: d.booking_ref,
    delivered: !!d.traveller_id, // traveller has redeemed → they can see it now
    filename: d.filename,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    category: d.category,
    uploadedAt: d.uploaded_at,
  }));
  return NextResponse.json({ ok: true, documents });
}

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file_required' }, { status: 400 });

  const bookingRef = String(form.get('bookingRef') || '').trim();
  if (!bookingRef) return NextResponse.json({ error: 'booking_ref_required' }, { status: 400 });

  if (file.size === 0) return NextResponse.json({ error: 'file_empty' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', message: 'Maximum 10 MB' }, { status: 400 });

  const filename = (file as File).name || 'document';
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) return NextResponse.json({ error: 'unsupported_type', message: 'PDF and common image formats only' }, { status: 400 });

  const requested = String(form.get('category') || '').trim() as DocumentCategory;
  const category: DocumentCategory = CATEGORIES.includes(requested) ? requested : categoriseFromFilename(filename).category;

  const supabase = getSupabaseAdmin();

  // Link a traveller if one has already redeemed this booking for this agency.
  const { data: traveller } = await supabase
    .from('travellers')
    .select('id')
    .eq('agency_id', claims.agencyId)
    .eq('booking_ref', bookingRef)
    .maybeSingle();
  const travellerId = (traveller as { id: string } | null)?.id ?? null;

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const safeRef = bookingRef.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const storagePath = `${claims.agencyId}/booking/${safeRef}/${crypto.randomUUID()}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, arrayBuffer, { contentType: mime, upsert: false });
  if (uploadErr) {
    console.error('[agency/documents] upload failed', uploadErr.message);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }

  const { data: row, error: insertErr } = await supabase
    .from('documents')
    .insert({
      agency_id: claims.agencyId,
      traveller_id: travellerId,
      booking_ref: bookingRef,
      storage_path: storagePath,
      filename,
      mime_type: mime,
      size_bytes: file.size,
      category,
      uploaded_by: claims.email,
    })
    .select('id, uploaded_at')
    .single();

  if (insertErr || !row) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    console.error('[agency/documents] insert failed', insertErr?.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  void logAuditEvent({
    eventType: 'document.uploaded',
    actor: claims.email,
    targetId: row.id as string,
    targetLabel: `${claims.agencyId} / ${bookingRef} / ${filename}`,
    metadata: { agencyId: claims.agencyId, bookingRef, category, filename, sizeBytes: file.size, via: 'agency_portal' },
  });

  return NextResponse.json({
    ok: true,
    document: { id: row.id, bookingRef, delivered: !!travellerId, filename, mimeType: mime, sizeBytes: file.size, category, uploadedAt: row.uploaded_at },
  }, { status: 201 });
}

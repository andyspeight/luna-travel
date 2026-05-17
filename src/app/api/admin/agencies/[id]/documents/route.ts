/**
 * /api/admin/agencies/[id]/documents
 *
 *   GET   — list documents for the agency, optional ?travellerId=...
 *   POST  — multipart upload: { file, travellerId, category? }
 *
 * Admin-gated (middleware).
 *
 * File size cap: 10 MB
 * Allowed types: PDF, common image formats. PDFs are the primary use case
 * (vouchers, tickets, certificates); images allowed as a sensible extension
 * since some agencies send photos of receipts/confirmations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { categoriseFromFilename, type DocumentCategory } from '@/lib/categorise-document';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'luna-travel-documents';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);
const CATEGORIES: DocumentCategory[] = ['voucher', 'ticket', 'itinerary', 'insurance', 'other'];

// ─────────── GET ───────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agencyId = params.id;
  if (!agencyId) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  const travellerId = req.nextUrl.searchParams.get('travellerId');

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from('documents')
    .select('id, agency_id, traveller_id, booking_ref, storage_path, filename, mime_type, size_bytes, category, uploaded_by, uploaded_at')
    .eq('agency_id', agencyId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });

  if (travellerId) {
    q = q.eq('traveller_id', travellerId);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[documents.GET]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({
    documents: (data || []).map((d) => ({
      id: d.id,
      agencyId: d.agency_id,
      travellerId: d.traveller_id,
      bookingRef: d.booking_ref,
      filename: d.filename,
      mimeType: d.mime_type,
      sizeBytes: d.size_bytes,
      category: d.category,
      uploadedBy: d.uploaded_by,
      uploadedAt: d.uploaded_at,
    })),
  });
}

// ─────────── POST ───────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agencyId = params.id;
  if (!agencyId) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  // Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }
  const travellerId = String(form.get('travellerId') || '').trim();
  const requestedCategory = String(form.get('category') || '').trim() as DocumentCategory;

  if (!travellerId) {
    return NextResponse.json({ error: 'traveller_required' }, { status: 400 });
  }

  // Validate file
  if (file.size === 0) {
    return NextResponse.json({ error: 'file_empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', message: 'Maximum 10 MB' }, { status: 400 });
  }
  // 'file' from FormData is a File (subclass of Blob); cast to read name + type
  const filename = (file as File).name || 'document';
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'unsupported_type', message: 'PDF and common image formats only' }, { status: 400 });
  }

  // Resolve category — explicit override > auto-detect > fallback
  let category: DocumentCategory;
  if (CATEGORIES.includes(requestedCategory)) {
    category = requestedCategory;
  } else {
    category = categoriseFromFilename(filename).category;
  }

  const supabase = getSupabaseAdmin();

  // Verify the traveller belongs to this agency (defence in depth)
  const { data: traveller, error: travErr } = await supabase
    .from('travellers')
    .select('id, agency_id, booking_ref')
    .eq('id', travellerId)
    .eq('agency_id', agencyId)
    .single();

  if (travErr || !traveller) {
    return NextResponse.json({ error: 'traveller_not_in_agency' }, { status: 400 });
  }

  // Build the storage path: agency/traveller/{uuid}_{safe-filename}
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const objectId = crypto.randomUUID();
  const storagePath = `${agencyId}/${travellerId}/${objectId}_${safeName}`;

  // Stream the bytes to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mime,
      upsert: false, // unique objectId guarantees no collision; refuse if reused
    });

  if (uploadErr) {
    console.error('[documents.POST] storage upload failed:', uploadErr.message);
    return NextResponse.json({ error: 'upload_failed', message: uploadErr.message }, { status: 500 });
  }

  const uploadedBy = req.headers.get('x-admin-email') || 'system';

  // Insert the row
  const { data: row, error: insertErr } = await supabase
    .from('documents')
    .insert({
      agency_id: agencyId,
      traveller_id: travellerId,
      booking_ref: traveller.booking_ref,
      storage_path: storagePath,
      filename,
      mime_type: mime,
      size_bytes: file.size,
      category,
      uploaded_by: uploadedBy,
    })
    .select('id, uploaded_at')
    .single();

  if (insertErr || !row) {
    // Roll back the storage object so we don't leak
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    console.error('[documents.POST] insert failed:', insertErr?.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  // Audit
  void logAuditEvent({
    eventType: 'document.uploaded',
    actor: uploadedBy,
    targetId: row.id as string,
    targetLabel: `${agencyId} / ${traveller.booking_ref ?? '—'} / ${filename}`,
    metadata: {
      agencyId,
      travellerId,
      category,
      filename,
      sizeBytes: file.size,
      mime,
    },
  });

  return NextResponse.json({
    document: {
      id: row.id,
      agencyId,
      travellerId,
      bookingRef: traveller.booking_ref,
      filename,
      mimeType: mime,
      sizeBytes: file.size,
      category,
      uploadedBy,
      uploadedAt: row.uploaded_at,
    },
  }, { status: 201 });
}

/**
 * POST /api/admin/import-pdf  (multipart: { file })
 *
 * Reads a supplier confirmation / e-ticket / itinerary PDF and returns a
 * form-ready DRAFT that the Add-booking form pre-fills for review. Creates
 * nothing — extraction only. Admin-gated. Agency-agnostic (the admin picks the
 * agency on the form). Prefers Luna Chat's AI service, falls back to a direct
 * Anthropic call; see docs/pdf-import.md.
 *
 * Responses:
 *   200 { ok:true, source, draft }            — extracted, ready to pre-fill
 *   422 { ok:false, configured:true, error }  — couldn't read this PDF
 *   501 { ok:false, configured:false, error } — not switched on (no backend)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { extractBookingFromPdf } from '@/lib/booking-extract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // PDF reasoning can take a while

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB (base64 ~21 MB, under Anthropic's 32 MB)

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', message: 'Maximum 16 MB' }, { status: 400 });
  }
  const mime = file.type || 'application/pdf';
  if (mime !== 'application/pdf') {
    return NextResponse.json({ error: 'unsupported_type', message: 'PDF files only' }, { status: 400 });
  }

  const filename = (file instanceof File ? file.name : '') || 'booking.pdf';
  const bytes = Buffer.from(await file.arrayBuffer());

  const result = await extractBookingFromPdf(bytes, filename, mime);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, configured: result.configured, error: result.error },
      { status: result.configured ? 422 : 501 },
    );
  }

  return NextResponse.json({ ok: true, source: result.source, draft: result.draft });
}

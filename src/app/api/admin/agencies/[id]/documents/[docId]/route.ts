/**
 * DELETE /api/admin/agencies/[id]/documents/[docId]
 *
 * Soft-delete a document: sets deleted_at, doesn't touch the storage object.
 * Storage cleanup happens via a separate cron later (not built yet).
 *
 * Admin-gated (middleware).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const agencyId = params.id;
  const docId = params.docId;
  if (!agencyId || !docId) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Look it up first so we can audit-log meaningful info and verify ownership
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, agency_id, traveller_id, booking_ref, filename, deleted_at')
    .eq('id', docId)
    .eq('agency_id', agencyId)
    .single();

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (doc.deleted_at) {
    // Already deleted — idempotent success
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  // Soft-delete
  const { error: updateErr } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', docId)
    .eq('agency_id', agencyId);

  if (updateErr) {
    console.error('[documents.DELETE]', updateErr.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  const actor = req.headers.get('x-admin-email') || 'system';
  void logAuditEvent({
    eventType: 'document.deleted',
    actor,
    targetId: docId,
    targetLabel: `${agencyId} / ${doc.booking_ref ?? '—'} / ${doc.filename}`,
    metadata: {
      agencyId,
      travellerId: doc.traveller_id,
      filename: doc.filename,
    },
  });

  return NextResponse.json({ ok: true });
}

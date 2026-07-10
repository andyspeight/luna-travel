/**
 * DELETE /api/agency/documents/[docId] — the signed-in agency soft-deletes one
 * of its own documents (sets deleted_at). Scoped to the session's agency, so an
 * agency can only remove its own documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: NextRequest, props: { params: Promise<{ docId: string }> }) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { docId } = await props.params;
  if (!docId || !UUID_RE.test(docId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq('id', docId)
    .eq('agency_id', claims.agencyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[agency/documents/delete] failed', error.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

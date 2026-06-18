/**
 * GET  /api/admin/agencies/[id]/extraction-profile  → ProfileSummary
 * PUT  /api/admin/agencies/[id]/extraction-profile   (body: { hints }) → { ok, summary }
 *
 * The per-agency PDF-import "training" profile: layout hints the admin can edit,
 * plus a count of bookings learned from reviewed imports. Admin-gated. [id] is
 * the agency's Control record id (recXXX).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { getProfileSummary, setProfileHints } from '@/lib/pdf-profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const agencyId = (params?.id || '').trim();
  if (!REC_ID_RE.test(agencyId)) return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });

  const summary = await getProfileSummary(agencyId);
  return NextResponse.json(summary);
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const agencyId = (params?.id || '').trim();
  if (!REC_ID_RE.test(agencyId)) return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const hints = typeof body.hints === 'string' ? body.hints : '';

  const ok = await setProfileHints(agencyId, hints);
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  const summary = await getProfileSummary(agencyId);
  return NextResponse.json({ ok: true, summary });
}

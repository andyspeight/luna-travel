/**
 * POST /api/admin/sync/run — admin-triggered Travelify sync sweep over all
 * active travellers. Powers the "Run sync now" button. Admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { runSyncSweep } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const summary = await runSyncSweep('manual');
  return NextResponse.json({ ok: true, ...summary });
}

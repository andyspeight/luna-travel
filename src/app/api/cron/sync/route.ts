/**
 * GET /api/cron/sync — scheduled Travelify sync sweep (Vercel Cron).
 *
 * Deliberately NOT under /api/admin so the edge middleware (which requires a
 * tg_session) doesn't block the cron. Gated here by CRON_SECRET: Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` when that env var is set. Until it is,
 * this returns 401 (harmless) and the admin "Run sync now" button is used instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSyncSweep } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const summary = await runSyncSweep('cron');
  return NextResponse.json({ ok: true, ...summary });
}

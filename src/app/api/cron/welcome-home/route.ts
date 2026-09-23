/**
 * GET /api/cron/welcome-home — the daily "Welcome home" notification.
 *
 * Once, in the week after a trip ends, each traveller with the app on a device
 * is asked how it went. The rules are in lib/welcome-home and the run in
 * lib/welcome-home-run; this route only authenticates and reports.
 *
 * Not under /api/admin, so the edge middleware (which wants a tg_session) does
 * not block the scheduler. Gated by CRON_SECRET, like the other crons.
 *
 * ?dryRun=1 lists who would be greeted without sending anything. It still
 * needs the secret, because the answer is a list of booking references.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/constant-time';
import { logAuditEvent } from '@/lib/audit';
import { runWelcomeHome } from '@/lib/welcome-home-run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
  const result = await runWelcomeHome({ dryRun });
  console.log('[cron.welcome-home]', dryRun ? 'DRY RUN' : 'live', result.summary);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  // Awaited: a floating promise on a serverless function races the instance
  // being frozen once the response is flushed.
  const audited =
    dryRun ||
    result.greeted.length === 0 ||
    (await logAuditEvent({
      eventType: 'push.welcome_home',
      actor: 'cron',
      targetLabel: result.summary,
      metadata: { window: result.window, greeted: result.greeted },
    }));

  if (!audited) {
    console.error('[cron.welcome-home] notifications went out but the audit row did not write');
  }

  return NextResponse.json({ ...result, audited });
}

/**
 * POST /api/traveller/ping
 *
 * Lightweight engagement telemetry. The PWA calls this when it opens (and
 * when it returns to the foreground), so we can report *real* active-user and
 * install numbers instead of guessing.
 *
 * What we record (append-only, one row per open):
 *   - traveller_id, agency_id  (from the session — never trusted from the body)
 *   - standalone               (true when launched from a home-screen install:
 *                               display-mode standalone / iOS navigator.standalone)
 *   - platform                 (coarse "Safari on iPhone" style string, no full UA)
 *
 * We do NOT store IP, precise UA, or any new PII. "Installs" is derived later
 * as "travellers who have ever opened in standalone mode" — an honest proxy,
 * since the browser gives no reliable server-side install event.
 *
 * Auth: traveller session cookie (lt_session), same as /api/traveller/documents.
 * Not behind the admin middleware.
 *
 * Throttle: at most one row per traveller per 10 minutes. Append-only inserts
 * are atomic, so there's no read-modify-write race on a counter.
 *
 * Always returns 204 (even when throttled or unauthenticated-ish) so the
 * client never retries or surfaces errors to the traveller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import { shortUserAgent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';
const THROTTLE_MS = 10 * 60 * 1000;

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  // Never let telemetry failures bubble up to the traveller.
  try {
    if (checkSupabaseEnv()) return noContent();

    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return noContent();

    const claims = await verifySession(token);
    if (!claims) return noContent();

    // Parse body defensively — only the standalone flag is read from it.
    let standalone = false;
    try {
      const body = await req.json();
      standalone = body?.standalone === true;
    } catch {
      /* no/!json body — treat as a plain open */
    }

    const supabase = getSupabaseAdmin();

    // Throttle: skip if this traveller already pinged in the last 10 minutes.
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { data: recent } = await supabase
      .from('app_opens')
      .select('id')
      .eq('traveller_id', claims.travellerId)
      .gte('opened_at', since)
      .limit(1);

    if (recent && recent.length > 0) return noContent();

    const { error } = await supabase.from('app_opens').insert({
      traveller_id: claims.travellerId,
      agency_id: claims.agencyId,
      standalone,
      platform: shortUserAgent(req),
    });

    // If the table doesn't exist yet (migration not run) we just swallow it —
    // the dashboard shows "—" for these metrics until the migration lands.
    if (error) console.warn('[ping] insert skipped:', error.message);

    return noContent();
  } catch (e) {
    console.warn('[ping] threw:', (e as Error).message);
    return noContent();
  }
}

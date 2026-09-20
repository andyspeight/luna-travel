/**
 * GET /api/admin/flight-selftest
 *
 * Walks the loop AeroDataBox will walk, by calling our own public webhook URL —
 * the exact string the subscribe route registers — once with a deliberately
 * wrong token and once with the real one.
 *
 * Deliberately a real round trip out to the public hostname rather than an
 * internal call. The point is to prove the path a third party will take: DNS,
 * TLS, routing, middleware, the token check and the handler. An internal call
 * would prove none of that.
 *
 * Costs nothing. Writes nothing. The right-token probe uses a subscription id
 * that matches no row, so the webhook finds nothing to update and says so.
 *
 * Admin-gated by src/middleware.ts, which covers /api/admin/*.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import {
  buildCallbackUrl,
  interpretSelfTest,
  notConfigured,
  type SelfTestStep,
} from '@/lib/flight-selftest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/** A minimal, well-formed AeroDataBox notification for a flight nobody is watching. */
function probePayload() {
  return {
    subscription: { id: `selftest-${Date.now()}` },
    flights: [{ status: 'Expected', departure: {}, arrival: {} }],
  };
}

async function post(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(probePayload()),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  return { status: res.status, body: (await res.text()).slice(0, 300) };
}

export async function GET(req: Request) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const publicBase = process.env.LUNA_TRAVEL_PUBLIC_URL || '';
  const token = process.env.AERODATABOX_WEBHOOK_TOKEN || '';

  const missing: string[] = [];
  if (!publicBase) missing.push('LUNA_TRAVEL_PUBLIC_URL');
  if (!token) missing.push('AERODATABOX_WEBHOOK_TOKEN');
  if (missing.length) {
    return NextResponse.json(notConfigured(missing));
  }

  const callbackUrl = buildCallbackUrl(publicBase, token);
  const steps: SelfTestStep[] = [];

  // ── 1. A bad token must be refused ──
  //
  // First because it is the cheaper failure to find: an endpoint that accepts
  // anything is worse than one nobody can reach.
  try {
    const bad = await post(buildCallbackUrl(publicBase, 'not-the-real-token'));
    steps.push(
      bad.status === 403
        ? { name: 'A wrong token is refused', ok: true, detail: 'Returned 403, as it should.' }
        : {
            name: 'A wrong token is refused',
            ok: false,
            detail: `Returned ${bad.status}, not 403.`,
            fix: 'The webhook is accepting unauthenticated updates. Anyone who finds the URL can write flight statuses to your travellers. Investigate before anything else.',
          },
    );
  } catch (e) {
    steps.push({
      name: 'A wrong token is refused',
      ok: false,
      detail: `Could not reach the URL: ${e instanceof Error ? e.message : String(e)}`,
      fix: 'Check LUNA_TRAVEL_PUBLIC_URL resolves to this deployment from the public internet.',
    });
  }

  // ── 2. The real token is accepted, and the handler runs ──
  try {
    const good = await post(callbackUrl);
    const answeredSensibly = good.status === 200 && /no matching trips|ok/.test(good.body);
    steps.push(
      answeredSensibly
        ? {
            name: 'The real token is accepted',
            ok: true,
            detail: `Returned 200 and handled the payload — ${good.body}`,
          }
        : {
            name: 'The real token is accepted',
            ok: false,
            detail: `Returned ${good.status}: ${good.body}`,
            fix:
              good.status === 403
                ? 'The token in AERODATABOX_WEBHOOK_TOKEN does not match the one this deployment expects. If it was rotated, re-subscribe every watched flight — existing subscriptions still carry the old token.'
                : 'The endpoint was reached but did not handle a well-formed payload. Check the function logs.',
          },
    );
  } catch (e) {
    steps.push({
      name: 'The real token is accepted',
      ok: false,
      detail: `Could not reach the URL: ${e instanceof Error ? e.message : String(e)}`,
      fix: 'Check LUNA_TRAVEL_PUBLIC_URL resolves to this deployment from the public internet.',
    });
  }

  const result = interpretSelfTest(steps, callbackUrl);
  console.log('[flight-selftest]', { ok: result.ok, url: result.callbackUrl });
  return NextResponse.json(result);
}

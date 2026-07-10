/**
 * GET /api/admin/flight-health — at-a-glance health of the live flight-alert
 * pipeline. Answers "is AeroDataBox actually working right now?" so a gate
 * change / cancellation can't silently fail to reach a traveller.
 *
 * Checks, in order of "will it even work":
 *   1. config — are the four env vars the pipeline needs set?
 *        AERODATABOX_API_KEY   — flight lookups + subscription registration
 *        AERODATABOX_WEBHOOK_TOKEN — the webhook rejects updates without it
 *        LUNA_TRAVEL_PUBLIC_URL — the callback URL AeroDataBox posts back to
 *        TG_INTERNAL_KEY       — auth for the internal subscribe routes
 *   2. balance — a LIVE call to AeroDataBox for the alert-credit balance. This
 *        both proves the key/API work AND surfaces the thing that silently
 *        kills alerts: running out of credits (no credits → no new
 *        subscriptions → travellers miss gate changes with no error anywhere).
 *   3. feed — a LIVE health probe of the live-flight-updates service.
 *   4. subscriptions — DB state: how many flights are actively watched and when
 *        the webhook last delivered an update.
 *
 * The balance/feed calls hit AeroDataBox meta/health endpoints (not flight
 * lookups), so they don't consume alert credits. Gated by requireAdmin.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { adaConfigured, probeAeroDataBox } from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Warn when the credit balance drops below this — enough runway to top up
// before subscriptions start failing.
const LOW_CREDIT_THRESHOLD = 100;

export async function GET(req: Request) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const config = {
    apiKey: adaConfigured(),
    webhookToken: !!process.env.AERODATABOX_WEBHOOK_TOKEN,
    publicUrl: !!process.env.LUNA_TRAVEL_PUBLIC_URL,
    internalKey: !!process.env.TG_INTERNAL_KEY,
  };

  // Robust live probe: reachable if ANY of balance / feed-health / a real flight
  // lookup responds 2xx, so a single unavailable endpoint can't falsely read the
  // whole pipeline as "down". Credits come from the balance endpoint when it
  // works; null means "couldn't read the balance" (not the same as API down).
  const probe = config.apiKey
    ? await probeAeroDataBox()
    : { reachable: false, status: null as number | null, credits: null as number | null, balanceOk: false, rawBalance: null as unknown };
  const apiReachable = probe.reachable;
  const credits = probe.credits;

  // DB state: active subscriptions + last webhook delivery.
  const supabase = getSupabaseAdmin();
  const subs = { active: 0, total: 0, withCoverage: 0, lastUpdate: null as string | null };
  try {
    const [{ count: total }, { count: active }, { count: withCoverage }, recent] = await Promise.all([
      supabase.from('trip_flights').select('*', { count: 'exact', head: true }),
      supabase.from('trip_flights').select('*', { count: 'exact', head: true }).eq('watch_state', 'active'),
      supabase.from('trip_flights').select('*', { count: 'exact', head: true }).eq('has_live_coverage', true),
      supabase.from('trip_flights').select('last_updated').order('last_updated', { ascending: false }).limit(1).maybeSingle(),
    ]);
    subs.total = total ?? 0;
    subs.active = active ?? 0;
    subs.withCoverage = withCoverage ?? 0;
    subs.lastUpdate = (recent.data as { last_updated?: string } | null)?.last_updated ?? null;
  } catch {
    /* leave zeros */
  }

  // Overall verdict. A 2xx from the subscription-balance endpoint means the
  // subscription system is accessible — so the pipeline is healthy even if we
  // can't name the specific credit field. Remaining budget on an API.Market plan
  // is metered as "API Units" (not this endpoint), so we don't alarm on the
  // native credit number; we point the operator at the API.Market dashboard.
  const configComplete = config.apiKey && config.webhookToken && config.publicUrl && config.internalKey;

  let status: 'operational' | 'degraded' | 'down';
  const reasons: string[] = [];
  if (!config.apiKey) {
    status = 'down';
    reasons.push('AERODATABOX_API_KEY is not set — flight lookups and subscriptions cannot run.');
  } else if (!apiReachable) {
    status = 'down';
    reasons.push(
      `AeroDataBox did not respond${probe.status ? ` (HTTP ${probe.status})` : ' (no response)'} — the API key ` +
        'is likely invalid/expired, or your plan does not permit these calls. Flight lookups will also fail. ' +
        'Check the AeroDataBox subscription on API.Market and renew/upgrade the key.',
    );
  } else if (!config.webhookToken || !config.publicUrl || !config.internalKey) {
    status = 'down';
    if (!config.webhookToken) reasons.push('AERODATABOX_WEBHOOK_TOKEN is not set — inbound alerts are rejected, so travellers get no updates.');
    if (!config.publicUrl) reasons.push('LUNA_TRAVEL_PUBLIC_URL is not set — the webhook callback URL cannot be built.');
    if (!config.internalKey) reasons.push('TG_INTERNAL_KEY is not set — flights are never auto-subscribed on app open.');
  } else if (!probe.balanceOk) {
    status = 'degraded';
    reasons.push(
      `Flight lookups work, but the subscription-balance endpoint returned ${probe.status ? `HTTP ${probe.status}` : 'an error'} — ` +
        'subscriptions may still register fine; verify on the API.Market dashboard.',
    );
  } else {
    status = 'operational';
  }

  return NextResponse.json({
    ok: true,
    status,
    reasons,
    config,
    configComplete,
    apiReachable,
    probeStatus: probe.status,
    balanceOk: probe.balanceOk,
    creditsRemaining: credits,
    rawBalance: probe.rawBalance,
    lowCreditThreshold: LOW_CREDIT_THRESHOLD,
    subscriptions: subs,
    checkedAt: new Date().toISOString(),
  });
}

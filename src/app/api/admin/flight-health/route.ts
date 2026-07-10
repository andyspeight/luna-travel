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
import { adaConfigured, getBalance, hasLiveFeed } from '@/lib/aerodatabox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Warn when the credit balance drops below this — enough runway to top up
// before subscriptions start failing.
const LOW_CREDIT_THRESHOLD = 100;
// A busy hub used purely to confirm the live-feed service is up.
const FEED_PROBE_ICAO = 'EGLL'; // London Heathrow

export async function GET(req: Request) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const config = {
    apiKey: adaConfigured(),
    webhookToken: !!process.env.AERODATABOX_WEBHOOK_TOKEN,
    publicUrl: !!process.env.LUNA_TRAVEL_PUBLIC_URL,
    internalKey: !!process.env.TG_INTERNAL_KEY,
  };

  // Live balance + feed probes (only if the key is even set).
  let balance: { creditsRemaining: number } | null = null;
  let apiReachable = false;
  let feedUp = false;
  if (config.apiKey) {
    balance = await getBalance();
    apiReachable = balance !== null;
    try {
      feedUp = await hasLiveFeed(FEED_PROBE_ICAO);
    } catch {
      feedUp = false;
    }
  }

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

  // Overall verdict.
  const configComplete = config.apiKey && config.webhookToken && config.publicUrl && config.internalKey;
  const lowCredits = balance !== null && balance.creditsRemaining < LOW_CREDIT_THRESHOLD;

  let status: 'operational' | 'degraded' | 'down';
  const reasons: string[] = [];
  if (!config.apiKey || !apiReachable) {
    status = 'down';
    if (!config.apiKey) reasons.push('AERODATABOX_API_KEY is not set — flight lookups and subscriptions cannot run.');
    else reasons.push('AeroDataBox did not respond — the API key may be invalid or the service is unreachable.');
  } else if (!config.webhookToken || !config.publicUrl || !config.internalKey) {
    status = 'down';
    if (!config.webhookToken) reasons.push('AERODATABOX_WEBHOOK_TOKEN is not set — inbound alerts are rejected, so travellers get no updates.');
    if (!config.publicUrl) reasons.push('LUNA_TRAVEL_PUBLIC_URL is not set — the webhook callback URL cannot be built.');
    if (!config.internalKey) reasons.push('TG_INTERNAL_KEY is not set — flights are never auto-subscribed on app open.');
  } else if (lowCredits || !feedUp) {
    status = 'degraded';
    if (lowCredits) reasons.push(`Only ${balance?.creditsRemaining} alert credits remaining — top up before they run out or new subscriptions will fail.`);
    if (!feedUp) reasons.push('The live-flight-updates feed health probe did not report OK just now (may be transient).');
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
    feedUp,
    creditsRemaining: balance?.creditsRemaining ?? null,
    lowCreditThreshold: LOW_CREDIT_THRESHOLD,
    subscriptions: subs,
    checkedAt: new Date().toISOString(),
  });
}

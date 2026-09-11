/**
 * Web Push — server side.
 *
 * Luna Travel is a PWA, so notifications go through the W3C Push API rather
 * than APNs/FCM directly. We encrypt a payload, sign it with our VAPID private
 * key, and POST it to the endpoint the browser gave us; the platform's push
 * service wakes the device and hands it to our service worker (worker/index.js),
 * which is what actually draws the notification. That worker runs with the app
 * closed — which is the whole point.
 *
 * Subscriptions live in luna_travel.push_subscriptions, ONE ROW PER DEVICE. A
 * traveller can have the app on a phone and a tablet, and each browser issues
 * its own subscription. (The legacy travellers.push_token column can't model
 * that — a subscription is an endpoint plus two keys, not a token — so it is
 * unused.)
 *
 * SETUP:
 *   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY   the same public key
 *   VAPID_PRIVATE_KEY                                 secret, server only
 *   VAPID_SUBJECT                                     mailto: or https: contact
 *   Generate with:  npx web-push generate-vapid-keys
 *
 * With no keys configured every send is a no-op that logs once — the app keeps
 * working, it simply cannot notify.
 */

import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabase';

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification should land, e.g. /notifications. */
  url?: string;
  /** Collapses same-tag notifications so five flight updates aren't five rows. */
  tag?: string;
  /**
   * Escalates how insistently the device presents it. A gate change and a
   * "hope you're having a lovely time" should not look identical on a lock
   * screen: urgent ones vibrate and stay put until dismissed.
   */
  urgent?: boolean;
}

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys not set — notifications are disabled');
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:ops@travelgenix.io',
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send to every device a traveller has registered.
 *
 * Never throws: a notification failing must not take down the message send or
 * the flight-status job that triggered it. Returns how many devices accepted
 * it, which is only useful for logging — delivery itself is best-effort, and a
 * phone that is off simply gets it later.
 */
export async function sendPushToTraveller(
  travellerId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  let subs: SubRow[] = [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('traveller_id', travellerId)
      .limit(20);
    if (error) {
      console.error('[push] could not load subscriptions', error.message);
      return { sent: 0, removed: 0 };
    }
    subs = (data ?? []) as SubRow[];
  } catch (e) {
    console.error('[push] subscription lookup threw', e instanceof Error ? e.message : e);
    return { sent: 0, removed: 0 };
  }

  if (!subs.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        // 404/410 mean the browser threw the subscription away (app deleted,
        // permission revoked, data cleared). Keeping it would retry forever.
        if (status === 404 || status === 410) {
          dead.push(s.id);
        } else {
          console.error('[push] send failed', status ?? '', e instanceof Error ? e.message : e);
        }
      }
    }),
  );

  if (dead.length) {
    try {
      await getSupabaseAdmin().from('push_subscriptions').delete().in('id', dead);
    } catch {
      /* pruning is housekeeping — a failure here costs nothing */
    }
  }

  if (sent) {
    try {
      await getSupabaseAdmin()
        .from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('traveller_id', travellerId);
    } catch {
      /* best effort */
    }
  }

  return { sent, removed: dead.length };
}

/** Fan out to several travellers — used by agency broadcast. */
export async function sendPushToTravellers(
  travellerIds: string[],
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!ensureConfigured() || !travellerIds.length) return { sent: 0 };
  let sent = 0;
  // Bounded concurrency. Fully sequential would make a broadcast to a few
  // hundred travellers take longer than the function is allowed to run; fully
  // parallel would open a few hundred simultaneous TLS connections from one
  // invocation. Ten at a time keeps a large broadcast to a couple of seconds.
  const CONCURRENCY = 10;
  for (let i = 0; i < travellerIds.length; i += CONCURRENCY) {
    const batch = travellerIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => sendPushToTraveller(id, payload)));
    for (const r of results) sent += r.sent;
  }
  return { sent };
}

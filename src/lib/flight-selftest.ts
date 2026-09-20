/**
 * Proving the flight-alert loop without waiting for a real traveller.
 *
 * The problem this solves: the Flight Hub has never fired. trip_flights is
 * empty, no alert has ever been sent, and the first real booking is currently
 * the test. If the callback URL or the webhook token is wrong, nobody finds out
 * until somebody's flight is cancelled and their phone stays silent.
 *
 * So this walks the loop AeroDataBox will walk. It calls our own public webhook
 * URL — the exact string subscribe() registers — first with a deliberately
 * wrong token, then with the real one. That proves, for real:
 *
 *   - LUNA_TRAVEL_PUBLIC_URL points at this deployment
 *   - the endpoint is reachable from outside (DNS, TLS, routing, middleware)
 *   - the token in our environment is the token the endpoint expects
 *   - a bad token is actually refused
 *   - the handler parses, queries and answers
 *
 * WHAT IT DOES NOT PROVE, and says so: that AeroDataBox will accept a
 * subscription, and that it will call us when a flight moves. Those need
 * credits and a real flight. This is the half that is free to check and, on the
 * evidence of every integration ever, the half most likely to be wrong.
 *
 * No writes, no credits, no cleanup needed.
 */

export interface SelfTestStep {
  name: string;
  ok: boolean;
  detail: string;
  /** What an operator should do about it. Absent when there is nothing to do. */
  fix?: string;
}

export interface SelfTestResult {
  ok: boolean;
  /** The callback URL, with the token replaced — safe to show and to log. */
  callbackUrl: string;
  steps: SelfTestStep[];
  summary: string;
}

/**
 * The callback URL exactly as the subscribe route builds it.
 *
 * Kept here, and tested, because a mismatch between what we register with
 * AeroDataBox and what we actually serve is invisible: subscriptions succeed,
 * updates go to a URL nobody is listening on, and everything looks fine until a
 * traveller is standing at a gate.
 */
export function buildCallbackUrl(publicBase: string, token: string): string {
  const base = (publicBase || '').trim().replace(/\/+$/, '');
  return `${base}/api/flights/webhook?t=${encodeURIComponent(token)}`;
}

/** The same URL with the token masked, for display and logs. */
export function redactCallbackUrl(url: string): string {
  return url.replace(/([?&]t=)[^&]*/, '$1********');
}

/**
 * Turn the raw step results into a verdict.
 *
 * Separate from the fetching so the interpretation can be tested — deciding
 * that "the endpoint answered 200 to a bad token" means the token check is
 * broken is exactly the sort of judgement worth pinning down.
 */
export function interpretSelfTest(steps: SelfTestStep[], callbackUrl: string): SelfTestResult {
  const failed = steps.filter((s) => !s.ok);
  const ok = failed.length === 0;

  let summary: string;
  if (ok) {
    summary =
      'The webhook loop works: the callback URL resolves to this deployment, the token matches, and a bad token is refused. ' +
      'Still unproven — that AeroDataBox accepts a subscription and calls us when a flight moves. Those need a real watched flight.';
  } else {
    summary = `${failed.length} of ${steps.length} checks failed. A flight change would not reach a traveller.`;
  }

  return { ok, callbackUrl: redactCallbackUrl(callbackUrl), steps, summary };
}

/** The step list for a run that could not start, so the UI shape never varies. */
export function notConfigured(missing: string[]): SelfTestResult {
  return {
    ok: false,
    callbackUrl: '',
    steps: [
      {
        name: 'Configuration',
        ok: false,
        detail: `Not set: ${missing.join(', ')}.`,
        fix: 'Set these in the Vercel project settings and redeploy. Until they are set, no flight alert can reach anybody.',
      },
    ],
    summary: 'Cannot run: the flight-alert pipeline is not configured.',
  };
}

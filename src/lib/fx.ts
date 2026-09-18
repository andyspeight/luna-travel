/**
 * Exchange rates — server only.
 *
 * The one utility on the essentials screen that genuinely needs the network.
 * Everything else there works on a plane; a rate cannot, so the contract is
 * different: the app keeps the last rate it was given and shows it with the
 * date it was good for. A stale rate honestly labelled is useful. A stale rate
 * presented as today's is worse than nothing.
 *
 * Provider is open.er-api.com: keyless, ~160 currencies, updates daily. Rates
 * are indicative — a bureau or a card will not match them, and the screen says
 * so rather than implying we are quoting a price.
 *
 * Follows the fetch pattern in weather.ts, including its revalidate window, so
 * there is one way external data is read in this app rather than two.
 */

const ER_API = 'https://open.er-api.com/v6/latest';

/** Six hours. The provider itself only moves daily; this is politeness, not precision. */
const REVALIDATE_SECONDS = 21_600;

export interface FxRate {
  base: string;
  quote: string;
  /** Units of `quote` for one unit of `base`. */
  rate: number;
  /** When the provider says the rate was set. ISO. */
  asOf: string;
}

const ISO_RE = /^[A-Z]{3}$/;

interface ErApiResponse {
  result?: string;
  base_code?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  rates?: Record<string, unknown>;
}

/**
 * One rate, or null.
 *
 * Null covers every failure the same way — provider down, currency unknown,
 * a shape we did not expect — because the screen's response to all of them is
 * identical: fall back to the last rate it holds, or hide the converter.
 */
export async function fetchRate(base: string, quote: string): Promise<FxRate | null> {
  const from = (base || '').toUpperCase();
  const to = (quote || '').toUpperCase();
  if (!ISO_RE.test(from) || !ISO_RE.test(to)) return null;

  // Same currency both sides is a real question with a trivial answer. Asking a
  // provider for GBP→GBP wastes a call to be told 1.
  if (from === to) {
    return { base: from, quote: to, rate: 1, asOf: new Date().toISOString() };
  }

  let data: ErApiResponse | null = null;
  try {
    const res = await fetch(`${ER_API}/${from}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.warn('[fx] provider returned', res.status);
      return null;
    }
    data = (await res.json()) as ErApiResponse;
  } catch (e) {
    console.warn('[fx] fetch failed', e instanceof Error ? e.message : e);
    return null;
  }

  if (!data || data.result !== 'success' || !data.rates) return null;

  const raw = data.rates[to];
  const rate = typeof raw === 'number' ? raw : Number(raw);
  // A zero or negative rate is not a rate, and NaN would render as "NaN baht".
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const asOf = data.time_last_update_unix
    ? new Date(data.time_last_update_unix * 1000).toISOString()
    : new Date().toISOString();

  return { base: from, quote: to, rate, asOf };
}

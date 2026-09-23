/**
 * Paying what a booking still owes — the same payment the My Booking widget
 * takes, raised through Control.
 *
 * The app does not take money and never sees a card. It asks Control
 * (tg-widgets /api/internal/pay-balance-by-client) to raise a Travelify
 * basket for the booking, and sends the traveller to the https page Travelify
 * returns: the agency's own secure payment page, exactly where the widget's Pay
 * balance button sends a customer.
 *
 * WHO DECIDES WHAT IS CHARGED. Control does, from the order it fetches from
 * Travelify itself, with the calculation the widget, the PDF and the payment
 * emails use. The amount the app passes is the one on the traveller's button,
 * and Control treats it as a request: it refuses anything over the real
 * outstanding, as it does for the widget's amount box.
 *
 * WHOSE BOOKING. The lookup triplet comes from the signed-in traveller's own
 * record on the server (api/traveller/pay), never from the phone, so nobody
 * can raise a payment page for somebody else's booking.
 *
 * Server only: it carries the internal key.
 */

const CONTROL_HOST = 'https://id.travelify.io';

export type PaymentRequest =
  | { kind: 'ok'; url: string; amount: number; currency: string }
  | { kind: 'no_balance' }
  | { kind: 'invalid_amount' }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

/**
 * An amount a traveller may ask to pay: positive, finite, whole pennies, and
 * absurdly large numbers refused before they go anywhere. Undefined means "let
 * Control decide", which is what the widget does with an untouched box.
 */
export function parseAmount(v: unknown): number | undefined | 'invalid' {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1_000_000) return 'invalid';
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return 'invalid';
  return Math.round(v * 100) / 100;
}

const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

export async function requestBalancePayment(input: {
  recordId: string;
  orderRef: string;
  email: string;
  departDate: string;
  amount?: number;
}): Promise<PaymentRequest> {
  const key = process.env.TG_INTERNAL_KEY;
  if (!key) {
    console.warn('[balance-payment] TG_INTERNAL_KEY is not set — payments are unavailable');
    return { kind: 'unavailable' };
  }

  let res: Response;
  try {
    res = await fetch(`${CONTROL_HOST}/api/internal/pay-balance-by-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TG-Internal-Key': key },
      body: JSON.stringify({
        recordId: input.recordId,
        orderRef: input.orderRef,
        emailAddress: input.email,
        departDate: input.departDate.slice(0, 10),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    console.error('[balance-payment] Control call threw', e instanceof Error ? e.message : e);
    return { kind: 'unavailable' };
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* an empty or non-JSON body is handled by the status below */
  }

  if (res.status === 400 && json.error === 'invalid_amount') return { kind: 'invalid_amount' };
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) {
    console.error('[balance-payment] Control refused', res.status, String(json.error ?? ''));
    return { kind: 'unavailable' };
  }
  if (json.noBalance === true) return { kind: 'no_balance' };

  // Defence in depth: Control already only returns https, but this URL is
  // where a traveller is sent to type their card number.
  const payment = (json.payment ?? {}) as Record<string, unknown>;
  if (json.ok !== true || !isHttps(json.url)) {
    console.error('[balance-payment] Control returned no usable payment page');
    return { kind: 'unavailable' };
  }
  return {
    kind: 'ok',
    url: json.url,
    amount: typeof payment.amount === 'number' ? payment.amount : 0,
    currency: typeof payment.currency === 'string' ? payment.currency : '',
  };
}

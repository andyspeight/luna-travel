'use client';

/**
 * Money still owed on the booking, on the home screen — and only then — with
 * the same Pay button the My Booking widget has.
 *
 * Most travellers are sent the app once they have paid, so for most of them
 * this never draws: a settled booking needs no card saying so, and a booking
 * whose balance the app cannot see gets no card either, because "paid in full"
 * on a guess is the one thing worse than silence. What is left is somebody who
 * genuinely owes money before they travel, and they should not find out from a
 * chase email.
 *
 * The figures are Control's (lib/order-money): the same ones the booking PDF,
 * the balance emails and the widget use. Pay asks the server for the agency's
 * secure Travelify payment page and goes there (lib/balance-payment). The app
 * never sees a card number, and Control, not the button, decides what may be
 * charged.
 *
 * In the demo there is no booking to pay against, so the button says what it
 * would do instead of doing it.
 */

import { useState } from 'react';
import type { Booking } from '@/types/booking';
import { paymentState } from '@/lib/order-money';
import { formatDate, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/locale-context';
import { useBooking } from '@/lib/booking-context';
import { IconCard, IconLock } from '@/components/icons';

// A due date is a day. Read in UTC so it is the same day wherever the phone is.
const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type PayState = 'idle' | 'opening' | 'demo' | 'failed' | 'changed' | 'settled';

export function BalanceCard({ booking, now }: { booking: Booking; now?: number }) {
  const { t } = useI18n();
  const { source } = useBooking();
  const [pay, setPay] = useState<PayState>('idle');
  const state = paymentState(booking.payment, now);
  if (state.kind !== 'owing') return null;

  const agency = booking.agency.name || 'your travel agent';
  const money = (n: number) => formatMoney(n, state.currency);
  // What the button pays: the next instalment when there is one, else the
  // balance. Control re-checks it against the real figure before charging.
  const toPay = state.nextPayment ?? state.balance;

  let when: string;
  if (state.dueNow) when = t('pay.dueNow');
  else if (state.dueDate && state.nextPayment) when = t('pay.nextDue', { amount: money(state.nextPayment), date: day(state.dueDate) });
  else if (state.dueDate) when = t('pay.dueBy', { date: day(state.dueDate) });
  else when = t('pay.ask', { agency });

  async function onPay() {
    if (source !== 'live') {
      setPay('demo');
      return;
    }
    setPay('opening');
    try {
      const res = await fetch('/api/traveller/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: toPay }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && typeof json.url === 'string' && json.url.startsWith('https://')) {
        window.location.assign(json.url);
        return; // stay on "opening" while the page changes
      }
      setPay(json.error === 'no_balance' ? 'settled' : json.error === 'balance_changed' ? 'changed' : 'failed');
    } catch {
      setPay('failed');
    }
  }

  const note: Partial<Record<PayState, string>> = {
    demo: t('pay.demo', { agency }),
    failed: t('pay.failed', { agency }),
    changed: t('pay.changed'),
    settled: t('pay.settled'),
  };

  return (
    <section
      data-testid="balance-card"
      aria-label={t('pay.leftToPay', { amount: money(state.balance) })}
      className="mt-4 rounded-2xl border border-line-light bg-surface px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
            state.dueNow ? 'bg-warning/15 text-warning-ink' : 'bg-teal/10 text-teal-dark dark:text-teal-light'
          }`}
        >
          <IconCard size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">
            {t('pay.leftToPay', { amount: money(state.balance) })}
          </span>
          <span className={`block text-[12px] ${state.dueNow ? 'font-semibold text-warning-ink' : 'text-ink-2'}`}>
            {when}
          </span>
        </span>
      </div>

      <button
        type="button"
        data-testid="balance-pay"
        onClick={onPay}
        disabled={pay === 'opening' || pay === 'settled'}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-[14px] font-semibold text-navy-on disabled:opacity-70 dark:bg-teal dark:text-teal-on"
      >
        <IconLock size={14} />
        {pay === 'opening' ? t('pay.opening') : t('pay.payNow', { amount: money(toPay) })}
      </button>

      <p role="status" className="mt-2 text-[12px] leading-snug text-ink-2">
        {note[pay] ?? t('pay.securely', { agency })}
      </p>
    </section>
  );
}

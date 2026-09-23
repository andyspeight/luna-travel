'use client';

/**
 * Money still owed on the booking, on the home screen — and only then.
 *
 * Most travellers are sent the app once they have paid, so for most of them
 * this never draws: a settled booking needs no card saying so, and a booking
 * whose balance the app cannot see gets no card either, because "paid in full"
 * on a guess is the one thing worse than silence. What is left is somebody who
 * genuinely owes money before they travel, and they should not find out from a
 * chase email.
 *
 * The figures are Control's (lib/order-money): the same ones the booking PDF,
 * the balance emails and the payment page use. The card goes to Help, because
 * the agency takes the payment, not the app.
 */

import Link from 'next/link';
import type { Booking } from '@/types/booking';
import { paymentState } from '@/lib/order-money';
import { formatDate, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/locale-context';
import { IconCard, IconChevR } from '@/components/icons';

// A due date is a day. Read in UTC so it is the same day wherever the phone is.
const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function BalanceCard({ booking, now }: { booking: Booking; now?: number }) {
  const { t } = useI18n();
  const state = paymentState(booking.payment, now);
  if (state.kind !== 'owing') return null;

  const agency = booking.agency.name || 'your travel agent';
  const money = (n: number) => formatMoney(n, state.currency);

  let when: string;
  if (state.dueNow) when = t('pay.dueNow');
  else if (state.dueDate && state.nextPayment) when = t('pay.nextDue', { amount: money(state.nextPayment), date: day(state.dueDate) });
  else if (state.dueDate) when = t('pay.dueBy', { date: day(state.dueDate) });
  else when = t('pay.ask', { agency });

  return (
    <Link
      href="/help"
      data-testid="balance-card"
      className="mt-4 flex min-h-[44px] items-center gap-3 rounded-2xl border border-line-light bg-surface px-4 py-3"
    >
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
      <IconChevR size={16} className="flex-none text-ink-3" />
    </Link>
  );
}

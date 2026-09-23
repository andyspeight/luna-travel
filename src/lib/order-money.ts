/**
 * What a booking still owes, as Control has already worked it out.
 *
 * The app knew a booking's total and nothing else. Every real booking arrived
 * with no balance, and Ask Luna read that absence as zero — so every traveller
 * who asked was told there was "nothing left to pay", whether or not there was.
 *
 * The figures were never missing. Control attaches `money` to every order it
 * returns: the one calculation (tg-widgets public/_order-money.js) that the My
 * Booking widget, the booking PDF, the confirmation email, the balance chase
 * emails and the pay-balance charge all read. It counts recorded payments and
 * gift vouchers, reconciles the instalment plan against what has actually been
 * paid — Travelify leaves the plan untouched after a payment — and floors the
 * balance at zero.
 *
 * So this does no arithmetic. It checks the shape and copies the figures
 * across. A second set of sums here would drift from the one a traveller is
 * charged against, and the day it did, the app and the payment email would
 * name different amounts.
 *
 * Anything missing or malformed leaves the balance UNKNOWN, never zero: an app
 * that says "paid in full" when it cannot see is worse than one that says
 * nothing.
 */

import type { PaymentBreakdown } from '@/types/booking';

/** The part of Control's `money` block the app reads. */
export interface RawMoney {
  currency?: unknown;
  total?: unknown;
  paid?: unknown;
  voucherCredit?: unknown;
  balance?: unknown;
  status?: unknown;
  nextDue?: {
    amount?: unknown;
    dueDate?: unknown;
    isInstalment?: unknown;
  } | null;
}

const amount = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

const isoDate = (v: unknown): string | undefined =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined;

/**
 * The payment block for a booking.
 *
 * `fallbackTotal` and `fallbackCurrency` are what the order carried before
 * Control sent `money` (summary.totalPrice), so an older response still shows
 * a total — just with the balance left unknown.
 */
export function paymentFromOrder(
  money: RawMoney | null | undefined,
  fallbackTotal: number | null | undefined,
  fallbackCurrency: string | null | undefined,
): PaymentBreakdown | undefined {
  const m = money && typeof money === 'object' ? money : null;
  const currency =
    (m && typeof m.currency === 'string' && m.currency.trim()) || (fallbackCurrency || '').trim();
  const total = amount(m?.total) || amount(fallbackTotal);
  if (!currency || !total) return undefined;

  const payment: PaymentBreakdown = { currency, total };

  const balance = amount(m?.balance);
  // 'none' is Control saying the order has no price to settle against, so
  // there is no balance to report either way.
  if (!m || balance === undefined || m.status === 'none') return payment;

  payment.balance = balance;
  const paid = amount(m.paid);
  const credit = amount(m.voucherCredit) ?? 0;
  if (paid !== undefined) payment.paid = paid + credit;

  if (balance > 0 && m.nextDue && typeof m.nextDue === 'object') {
    const due = isoDate(m.nextDue.dueDate);
    if (due) payment.balanceDueDate = due;
    const next = amount(m.nextDue.amount);
    // Only when it is a genuine instalment smaller than the balance — "your
    // next payment is £3,344 of £3,344" says the same thing twice.
    if (next && next < balance && m.nextDue.isInstalment === true) payment.nextPayment = next;
  }

  return payment;
}

export type PaymentState =
  | { kind: 'unknown' }
  | { kind: 'settled' }
  | {
      kind: 'owing';
      balance: number;
      currency: string;
      /** YYYY-MM-DD, when the booking says. */
      dueDate?: string;
      /** The due date has arrived or passed. */
      dueNow: boolean;
      /** The next instalment, when smaller than the balance. */
      nextPayment?: number;
    };

/**
 * What to tell a traveller about paying, read the same way everywhere — the
 * home screen and Ask Luna must never disagree about whether money is owed.
 *
 * Compares calendar dates in UTC: a due date is a day, not a moment.
 */
export function paymentState(
  payment: PaymentBreakdown | null | undefined,
  now: number = Date.now(),
): PaymentState {
  if (!payment || typeof payment.balance !== 'number' || !Number.isFinite(payment.balance)) {
    return { kind: 'unknown' };
  }
  if (payment.balance <= 0) return { kind: 'settled' };
  const today = new Date(now).toISOString().slice(0, 10);
  const dueDate = payment.balanceDueDate?.slice(0, 10) || undefined;
  return {
    kind: 'owing',
    balance: payment.balance,
    currency: payment.currency,
    dueDate,
    dueNow: !!dueDate && dueDate <= today,
    nextPayment:
      payment.nextPayment && payment.nextPayment < payment.balance ? payment.nextPayment : undefined,
  };
}

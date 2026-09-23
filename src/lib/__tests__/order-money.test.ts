import { describe, it, expect } from 'vitest';
import { paymentFromOrder, paymentState, type RawMoney } from '@/lib/order-money';
import { orderToBooking, type TrimmedOrder } from '@/lib/order-to-booking';

/**
 * Reading what a booking owes from Control's `money` block.
 *
 * The figures below are shaped exactly as tg-widgets public/_order-money.js
 * returns them (computeOrderMoney). The one rule that matters: a balance the
 * app cannot see is unknown, never zero.
 */

/** A holiday with a deposit paid and the balance in two instalments. */
const PART_PAID: RawMoney = {
  currency: 'GBP',
  total: 4180,
  paid: 836,
  voucherCredit: 0,
  balance: 3344,
  status: 'partly',
  nextDue: { amount: 1672, dueDate: '2026-10-08', remainingAmount: 1672, isInstalment: true } as RawMoney['nextDue'],
};

describe('paymentFromOrder', () => {
  it('copies the balance, what has been paid, and the next instalment', () => {
    expect(paymentFromOrder(PART_PAID, 4180, 'GBP')).toEqual({
      currency: 'GBP',
      total: 4180,
      paid: 836,
      balance: 3344,
      balanceDueDate: '2026-10-08',
      nextPayment: 1672,
    });
  });

  it('reads a settled booking as settled', () => {
    const p = paymentFromOrder({ ...PART_PAID, paid: 4180, balance: 0, status: 'settled', nextDue: null }, 4180, 'GBP');
    expect(p?.balance).toBe(0);
    expect(p?.balanceDueDate).toBeUndefined();
  });

  // TG120193: a £9.17 holiday paid entirely with a £9.17 gift voucher was
  // shown everywhere as £9.17 still due. The credit counts as paid.
  it('counts gift-voucher credit as paid', () => {
    const p = paymentFromOrder(
      { currency: 'GBP', total: 9.17, paid: 0, voucherCredit: 9.17, balance: 0, status: 'settled', nextDue: null },
      9.17,
      'GBP',
    );
    expect(p).toMatchObject({ balance: 0, paid: 9.17 });
  });

  // The rule this file exists for.
  it('leaves the balance unknown when Control sent no money block', () => {
    const p = paymentFromOrder(undefined, 6240, 'GBP');
    expect(p).toEqual({ currency: 'GBP', total: 6240 });
    expect('balance' in (p as object)).toBe(false);
  });

  it('leaves the balance unknown rather than trusting a malformed one', () => {
    for (const balance of [null, '3344', -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = paymentFromOrder({ ...PART_PAID, balance } as RawMoney, 4180, 'GBP');
      expect(p?.balance, String(balance)).toBeUndefined();
    }
  });

  it('reports no balance for an order Control says has no price', () => {
    const p = paymentFromOrder({ currency: 'GBP', total: 0, paid: 0, balance: 0, status: 'none' }, 500, 'GBP');
    expect(p).toEqual({ currency: 'GBP', total: 500 });
  });

  it('shows nothing at all without a total or a currency', () => {
    expect(paymentFromOrder(undefined, 0, 'GBP')).toBeUndefined();
    expect(paymentFromOrder(undefined, 500, '')).toBeUndefined();
  });

  it("prefers Control's total and currency to the older summary figures", () => {
    const p = paymentFromOrder({ ...PART_PAID, total: 4200, currency: 'EUR' }, 4180, 'GBP');
    expect(p).toMatchObject({ total: 4200, currency: 'EUR' });
  });

  it('does not call the whole balance the "next payment"', () => {
    const one = paymentFromOrder(
      { ...PART_PAID, nextDue: { amount: 3344, dueDate: '2026-10-08', isInstalment: false } },
      4180,
      'GBP',
    );
    expect(one?.nextPayment).toBeUndefined();
    expect(one?.balanceDueDate).toBe('2026-10-08');
  });

  // With no schedule Control gives no date; the app must not make one up.
  it('carries no due date when the booking has none', () => {
    const p = paymentFromOrder({ ...PART_PAID, nextDue: { amount: 3344, dueDate: null, isInstalment: false } }, 4180, 'GBP');
    expect(p?.balanceDueDate).toBeUndefined();
  });

  it('trims a timestamp to the day', () => {
    const p = paymentFromOrder({ ...PART_PAID, nextDue: { ...PART_PAID.nextDue, dueDate: '2026-10-08T00:00:00Z' } }, 4180, 'GBP');
    expect(p?.balanceDueDate).toBe('2026-10-08');
  });
});

describe('paymentState', () => {
  const NOW = Date.parse('2026-09-23T12:00:00Z');

  it('is unknown when there is no balance to read', () => {
    expect(paymentState(undefined, NOW)).toEqual({ kind: 'unknown' });
    expect(paymentState({ currency: 'GBP', total: 6240 }, NOW)).toEqual({ kind: 'unknown' });
  });

  it('is settled at zero', () => {
    expect(paymentState({ currency: 'GBP', total: 6240, balance: 0 }, NOW)).toEqual({ kind: 'settled' });
  });

  it('is owing, with the date still to come', () => {
    const p = paymentFromOrder(PART_PAID, 4180, 'GBP');
    expect(paymentState(p, NOW)).toEqual({
      kind: 'owing',
      balance: 3344,
      currency: 'GBP',
      dueDate: '2026-10-08',
      dueNow: false,
      nextPayment: 1672,
    });
  });

  it('is due now on the day, and after it', () => {
    const p = { currency: 'GBP', total: 4180, balance: 3344, balanceDueDate: '2026-09-23' };
    expect(paymentState(p, NOW)).toMatchObject({ kind: 'owing', dueNow: true });
    expect(paymentState({ ...p, balanceDueDate: '2026-09-01' }, NOW)).toMatchObject({ dueNow: true });
    expect(paymentState({ ...p, balanceDueDate: '2026-09-24' }, NOW)).toMatchObject({ dueNow: false });
  });

  it('is not due now when there is no date', () => {
    expect(paymentState({ currency: 'GBP', total: 4180, balance: 3344 }, NOW)).toMatchObject({
      kind: 'owing',
      dueNow: false,
      dueDate: undefined,
    });
  });
});

// The seam. Every piece above could pass while the mapper went on ignoring
// `money`, which is exactly how the balance went missing in the first place.
describe('orderToBooking', () => {
  const order = (money?: RawMoney): TrimmedOrder => ({
    id: 1,
    currency: 'GBP',
    items: [
      {
        id: 1,
        product: 'Tickets & Attractions',
        startDate: '2026-10-23T10:00:00',
        ticketsAttractions: {
          name: 'Attraction',
          location: { city: 'Orlando', country: 'US' },
          selectedOption: { scheduledDateTime: '2026-10-23T10:00:00' },
        },
      },
    ],
    summary: { totalPrice: 4180, earliestStart: '2026-10-23T00:00:00', latestEnd: '2026-10-30' },
    money,
  });

  it('carries the balance Control sent through to the booking', () => {
    expect(orderToBooking(order(PART_PAID), null, 'ABC123')?.payment).toMatchObject({
      balance: 3344,
      balanceDueDate: '2026-10-08',
      nextPayment: 1672,
    });
  });

  it('still shows the total, and no balance, from an order without one', () => {
    const p = orderToBooking(order(), null, 'ABC123')?.payment;
    expect(p).toEqual({ currency: 'GBP', total: 4180 });
  });
});

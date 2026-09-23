import { describe, it, expect } from 'vitest';
import { translate, LOCALES, type Locale } from '@/lib/i18n';

/**
 * The wording on the balance card, in every language the app ships.
 *
 * A token lost in translation would print "{amount}" at somebody who owes
 * money, which is the worst possible place for the app to look broken.
 */

const CODES = LOCALES.map((l) => l.code) as Locale[];
const VARS = { amount: '£3,344.00', date: '8 Oct 2026', agency: 'Travelgenix' };

const TOKENS: Record<string, Array<keyof typeof VARS>> = {
  'pay.leftToPay': ['amount'],
  'pay.dueNow': [],
  'pay.nextDue': ['amount', 'date'],
  'pay.dueBy': ['date'],
  'pay.ask': ['agency'],
  'pay.payNow': ['amount'],
  'pay.opening': [],
  'pay.securely': ['agency'],
  'pay.demo': ['agency'],
  'pay.failed': ['agency'],
  'pay.changed': [],
  'pay.settled': [],
};

describe('the payment labels', () => {
  it('exist in every language, with every value filled in', () => {
    for (const [key, tokens] of Object.entries(TOKENS)) {
      for (const locale of CODES) {
        const line = translate(locale, key, VARS);
        expect(line, `${key} in ${locale}`).not.toBe(key);
        expect(line, `${key} in ${locale}`).not.toMatch(/[{}]/);
        for (const tok of tokens) expect(line, `${key} in ${locale}`).toContain(VARS[tok]);
      }
    }
  });

  it('are translated, not the English pasted across', () => {
    for (const key of Object.keys(TOKENS)) {
      for (const locale of CODES.filter((c) => c !== 'en')) {
        expect(translate(locale, key, VARS), `${key} in ${locale}`).not.toBe(translate('en', key, VARS));
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { translate, LOCALES, type Locale } from '@/lib/i18n';

/**
 * The labels that keep a suggestion from reading like a booking.
 *
 * A priced card with a photograph sits on the home screen directly below the
 * traveller's confirmed itinerary. If the label is missing in somebody's
 * language it falls back to English, which for this particular string is the
 * difference between a warning and no warning — so the translations are the
 * feature rather than decoration around it.
 *
 * Driven through translate(), which is what the app calls, rather than
 * reaching into the table.
 */

const CODES = LOCALES.map((l) => l.code) as Locale[];
const OTHERS = CODES.filter((c) => c !== 'en');

const LABELS = [
  'next.notBooked',
  'next.ideaNote',
  'next.ideaNoteShort',
  'itin.allConfirmed',
  'whatson.note',
];

describe('the not-booked labels', () => {
  // translate() returns the key itself when there is no row, so this catches a
  // typo'd key that would otherwise print "next.notBooked" on the card.
  it('exist, rather than printing their own key at a traveller', () => {
    for (const key of LABELS) {
      expect(translate('en', key), key).not.toBe(key);
    }
  });

  it('say something in every language the app ships', () => {
    for (const key of LABELS) {
      for (const locale of CODES) {
        const value = translate(locale, key, { agency: 'Travelgenix' });
        expect(value.trim().length, `${key} is empty in ${locale}`).toBeGreaterThan(0);
        expect(value, `${key} falls through to its key in ${locale}`).not.toBe(key);
      }
    }
  });

  it('are actually translated, not the English pasted across', () => {
    for (const locale of OTHERS) {
      expect(
        translate(locale, 'next.notBooked').toLowerCase(),
        `next.notBooked is still English in ${locale}`,
      ).not.toBe(translate('en', 'next.notBooked').toLowerCase());
    }
  });

  it('names the agency in every language rather than leaving a gap', () => {
    for (const locale of CODES) {
      const line = translate(locale, 'next.ideaNote', { agency: 'Travelgenix' });
      expect(line, locale).toContain('Travelgenix');
      // A locale that lost the token would render the brace literally.
      expect(line, locale).not.toContain('{agency}');
    }
  });

  it('says what it means without hedging', () => {
    expect(translate('en', 'next.notBooked')).toBe('Not booked');
    // Both forms carry the sentence that matters; only the agency name differs.
    for (const locale of CODES) {
      expect(translate(locale, 'next.ideaNoteShort').trim().length, locale).toBeGreaterThan(0);
    }
    expect(translate('en', 'next.ideaNote', { agency: 'Travelgenix' })).toMatch(
      /nothing here is part of your booking/i,
    );
  });

  // The counterpart. A screen that says nothing is as ambiguous as one that
  // labels everything, so the confirmed side makes its own statement.
  it('has a matching statement for the screen that IS the booking', () => {
    expect(translate('en', 'itin.allConfirmed')).toMatch(/booked and confirmed/i);
    for (const locale of CODES) {
      expect(translate(locale, 'itin.allConfirmed').trim().length, locale).toBeGreaterThan(0);
    }
  });
});

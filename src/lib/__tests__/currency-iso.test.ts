import { describe, it, expect } from 'vitest';
import { currencyIso, currencyName, currencySymbol } from '@/lib/currency-iso';

describe('currencyIso', () => {
  it('reads the common labels the content base actually holds', () => {
    expect(currencyIso('Euro (€)')).toBe('EUR');
    expect(currencyIso('Thai Baht (฿)')).toBe('THB');
    expect(currencyIso('US Dollar ($)')).toBe('USD');
    expect(currencyIso('Pound Sterling (£)')).toBe('GBP');
    expect(currencyIso('Japanese Yen (¥)')).toBe('JPY');
    expect(currencyIso('Maldivian Rufiyaa (Rf)')).toBe('MVR');
  });

  it('prefers a code somebody typed in the brackets', () => {
    expect(currencyIso('Swiss Franc (CHF)')).toBe('CHF');
    expect(currencyIso('Caribbean Guilder (XCG)')).toBe('XCG');
    expect(currencyIso('Romanian Leu (RON)')).toBe('RON');
  });

  // Both spellings are live in the base, on neighbouring islands.
  it('accepts East and Eastern Caribbean Dollar', () => {
    expect(currencyIso('East Caribbean Dollar (EC$)')).toBe('XCD');
    expect(currencyIso('Eastern Caribbean Dollar ($)')).toBe('XCD');
  });

  it('copes with an ampersand in the name', () => {
    expect(currencyIso('Trinidad & Tobago Dollar ($)')).toBe('TTD');
  });

  // Zimbabwe's record says what people actually pay in, and it is right to.
  it('takes a leading code when the label leads with one', () => {
    expect(currencyIso('USD in practice (official: ZiG)')).toBe('USD');
  });

  // Rule 8: a guess here shows a traveller the wrong exchange rate.
  it('returns null rather than guessing', () => {
    expect(currencyIso('Some Invented Dollar (§)')).toBeNull();
    expect(currencyIso('')).toBeNull();
    expect(currencyIso(null)).toBeNull();
    expect(currencyIso(undefined)).toBeNull();
  });

  // The static guide qualifies some labels; the qualification is advice, not
  // part of the currency's name.
  it('reads a qualified label', () => {
    expect(currencyIso('Maldivian Rufiyaa · USD widely accepted')).toBe('MVR');
    expect(currencyIso('Euro')).toBe('EUR');
    expect(currencyIso('UAE Dirham (AED)')).toBe('AED');
  });

  it('does not mistake a symbol for a code', () => {
    // Three characters, but not three letters.
    expect(currencyIso('Costa Rican Colon (₡)')).toBe('CRC');
  });
});

describe('currencyName', () => {
  it('drops the brackets', () => {
    expect(currencyName('Thai Baht (฿)')).toBe('Thai Baht');
    expect(currencyName('Euro (€)')).toBe('Euro');
  });

  // It labels an input box, where the qualifier wraps onto three lines and
  // buries the number it is labelling.
  it('drops a qualifier too', () => {
    expect(currencyName('Maldivian Rufiyaa · USD widely accepted')).toBe('Maldivian Rufiyaa');
  });

  it('survives a label with no brackets at all', () => {
    expect(currencyName('Euro')).toBe('Euro');
    expect(currencyName(null)).toBe('');
  });
});

describe('currencySymbol', () => {
  it('returns the symbol', () => {
    expect(currencySymbol('Thai Baht (฿)')).toBe('฿');
    expect(currencySymbol('Barbadian Dollar (Bds$)')).toBe('Bds$');
  });

  it('never returns a code as though it were a symbol', () => {
    expect(currencySymbol('Swiss Franc (CHF)')).toBe('');
  });

  it('never returns a note as though it were a symbol', () => {
    expect(currencySymbol('USD in practice (official: ZiG)')).toBe('');
  });
});

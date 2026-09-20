import { describe, it, expect } from 'vitest';
import {
  buildCallbackUrl,
  redactCallbackUrl,
  interpretSelfTest,
  notConfigured,
  type SelfTestStep,
} from '@/lib/flight-selftest';

/**
 * A mismatch between the URL we register with AeroDataBox and the URL we
 * actually serve is invisible: subscriptions succeed, updates go nowhere, and
 * everything looks fine until somebody is standing at a gate.
 */
describe('buildCallbackUrl', () => {
  it('builds the URL the subscribe route registers', () => {
    expect(buildCallbackUrl('https://my-booking.co', 'abc123')).toBe(
      'https://my-booking.co/api/flights/webhook?t=abc123',
    );
  });

  it('does not double the slash when the base has a trailing one', () => {
    expect(buildCallbackUrl('https://my-booking.co/', 'abc123')).toBe(
      'https://my-booking.co/api/flights/webhook?t=abc123',
    );
    expect(buildCallbackUrl('https://my-booking.co///', 'abc123')).not.toContain('//api');
  });

  it('escapes a token that would otherwise break the query string', () => {
    expect(buildCallbackUrl('https://x.co', 'a b&c=d')).toBe(
      'https://x.co/api/flights/webhook?t=a%20b%26c%3Dd',
    );
  });

  it('tolerates whitespace around the base', () => {
    expect(buildCallbackUrl('  https://my-booking.co  ', 't')).toBe(
      'https://my-booking.co/api/flights/webhook?t=t',
    );
  });
});

describe('redactCallbackUrl', () => {
  // This string goes into logs and onto a screen.
  it('never shows the token', () => {
    const url = buildCallbackUrl('https://my-booking.co', 'super-secret-token');
    const shown = redactCallbackUrl(url);
    expect(shown).not.toContain('super-secret-token');
    expect(shown).toContain('my-booking.co/api/flights/webhook');
  });

  it('leaves a URL with no token alone', () => {
    expect(redactCallbackUrl('https://x.co/api/flights/webhook')).toBe(
      'https://x.co/api/flights/webhook',
    );
  });
});

const pass = (name: string): SelfTestStep => ({ name, ok: true, detail: 'fine' });
const fail = (name: string): SelfTestStep => ({ name, ok: false, detail: 'not fine' });

describe('interpretSelfTest', () => {
  it('passes only when every step passed', () => {
    expect(interpretSelfTest([pass('a'), pass('b')], 'https://x.co?t=k').ok).toBe(true);
    expect(interpretSelfTest([pass('a'), fail('b')], 'https://x.co?t=k').ok).toBe(false);
  });

  // The honesty that makes the result worth trusting: it says what it did NOT
  // prove, so a green result is not mistaken for "flight alerts work".
  it('is explicit about what it has not proven', () => {
    const r = interpretSelfTest([pass('a')], 'https://x.co?t=k');
    expect(r.summary).toMatch(/still unproven|unproven/i);
    expect(r.summary).toMatch(/subscription|calls us/i);
  });

  it('says plainly what a failure means for a traveller', () => {
    const r = interpretSelfTest([fail('a'), pass('b')], 'https://x.co?t=k');
    expect(r.summary).toMatch(/would not reach a traveller/i);
    expect(r.summary).toContain('1 of 2');
  });

  it('redacts the token in the result it returns', () => {
    const r = interpretSelfTest([pass('a')], buildCallbackUrl('https://x.co', 'secret'));
    expect(r.callbackUrl).not.toContain('secret');
  });
});

describe('notConfigured', () => {
  it('names what is missing and what it costs', () => {
    const r = notConfigured(['LUNA_TRAVEL_PUBLIC_URL']);
    expect(r.ok).toBe(false);
    expect(r.steps[0].detail).toContain('LUNA_TRAVEL_PUBLIC_URL');
    expect(r.steps[0].fix).toMatch(/no flight alert can reach anybody/i);
  });

  it('keeps the same shape as a real run, so the UI never has to branch', () => {
    const r = notConfigured(['X']);
    expect(Array.isArray(r.steps)).toBe(true);
    expect(typeof r.summary).toBe('string');
    expect(typeof r.callbackUrl).toBe('string');
  });
});

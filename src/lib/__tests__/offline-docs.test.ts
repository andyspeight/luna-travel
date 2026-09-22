import { describe, it, expect } from 'vitest';
import { summarise, DOC_CACHE } from '@/lib/offline-docs';

/**
 * The screen used to print "All saved on this device" whenever it had any
 * documents at all — no check, and nothing actually stored. A traveller
 * landing with no signal would have found an empty screen, having been told
 * the opposite on the way out.
 *
 * So the tests that matter here are the ones about NOT claiming things.
 */

const s = (total: number, stored: number, opts: { supported?: boolean; online?: boolean } = {}) =>
  summarise({ total, stored, supported: opts.supported ?? true, online: opts.online ?? true });

describe('it never claims documents are saved when they are not', () => {
  // THE bug. This is the exact case that printed a green tick.
  it('does not claim anything with nothing stored', () => {
    const r = s(4, 0);
    expect(r.badge).toBe(false);
    expect(r.text).not.toMatch(/saved on this phone/i);
  });

  it('does not say "all" when only some are stored', () => {
    const r = s(4, 3);
    expect(r.badge).toBe(false);
    expect(r.text).toBe('3 of 4 saved on this phone');
  });

  it('only shows the badge when every one of them is stored', () => {
    expect(s(4, 4).badge).toBe(true);
    expect(s(4, 4).text).toBe('All 4 saved on this phone');
    expect(s(1, 1).text).toBe('All 1 saved on this phone');
  });
});

describe('when the device cannot store them', () => {
  // A private window or an older browser. The documents still open online, so
  // this is a limitation rather than a fault — and claiming they were saved
  // would be the only real failure available.
  it('says nothing about saving rather than implying a failure', () => {
    const r = s(4, 0, { supported: false });
    expect(r.text).toBe('4 documents');
    expect(r.badge).toBe(false);
    expect(r.warn).toBe(false);
  });
});

describe('offline, with nothing stored', () => {
  // The worst case, and the one worth flagging: no signal and no files.
  it('warns rather than sitting there saying "saving…" forever', () => {
    const r = s(4, 0, { online: false });
    expect(r.warn).toBe(true);
    expect(r.text).toMatch(/not saved/i);
    expect(r.text).not.toMatch(/saving/i);
  });

  it('says it is still working on it while there is a connection', () => {
    const r = s(4, 0, { online: true });
    expect(r.text).toMatch(/saving/i);
    expect(r.warn).toBe(false);
  });
});

describe('no documents at all', () => {
  it('says so plainly and claims nothing', () => {
    const r = s(0, 0);
    expect(r.text).toBe('Nothing here yet');
    expect(r.badge).toBe(false);
    expect(r.warn).toBe(false);
  });
});

describe('plurals', () => {
  it('reads correctly for one', () => {
    expect(s(1, 0).text).toMatch(/^1 document ·/);
    expect(s(1, 0, { supported: false }).text).toBe('1 document');
  });
});

describe('the cache name', () => {
  // It is duplicated in next.config.js. If the two drift, the app fills one
  // cache and reads another, and every document reads as unsaved for ever.
  it('is the one the service worker rule writes to', () => {
    expect(DOC_CACHE).toBe('traveller-documents');
  });
});

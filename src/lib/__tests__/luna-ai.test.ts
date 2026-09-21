import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isRefusal, CANNOT_ANSWER, lunaAiStatus, lunaAiConfigured } from '@/lib/luna-ai';

// The model is told to return a bare marker when the context cannot answer.
// Treating a wrapped one as an answer would show a traveller the word
// CANNOT_ANSWER, which is worse than the handoff it was meant to trigger.
describe('isRefusal', () => {
  it('catches the bare marker', () => {
    expect(isRefusal(CANNOT_ANSWER)).toBe(true);
    expect(isRefusal(`  ${CANNOT_ANSWER}  `)).toBe(true);
  });

  it('catches a marker the model wrapped in a sentence anyway', () => {
    expect(isRefusal(`${CANNOT_ANSWER}.`)).toBe(true);
    expect(isRefusal(`I'm afraid ${CANNOT_ANSWER}`)).toBe(true);
  });

  it('treats nothing at all as a refusal', () => {
    expect(isRefusal('')).toBe(true);
    expect(isRefusal('   ')).toBe(true);
    expect(isRefusal(undefined)).toBe(true);
  });

  it('does not throw away a real answer', () => {
    expect(isRefusal('Your flight lands at 07:25 on 28 November.')).toBe(false);
    expect(isRefusal('The house reef is a short swim from the jetty.')).toBe(false);
  });

  // A long answer that happens to discuss what Luna cannot do is still an
  // answer, so the check is length-bounded rather than a bare substring.
  it('does not mistake a long answer that mentions the marker', () => {
    const essay = `There is plenty to do on a wet afternoon. ${CANNOT_ANSWER} `.padEnd(400, 'x');
    expect(isRefusal(essay)).toBe(false);
  });
});

/**
 * What the admin screen is allowed to claim.
 *
 * lunaAiConfigured is optimistic on purpose — a wasted attempt ends in the
 * agent handoff, which is where an early return would land the traveller
 * anyway. A dashboard has the opposite duty: a green tile that lies is how
 * something stays broken for months.
 */
describe('lunaAiStatus', () => {
  const real = { ...process.env };
  beforeEach(() => {
    delete process.env.LUNA_CHAT_URL;
    delete process.env.TG_INTERNAL_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => { process.env = { ...real }; });

  it('says off when nothing is set', () => {
    const s = lunaAiStatus();
    expect(s.state).toBe('off');
    expect(s.via).toBeNull();
    expect(s.detail).toMatch(/LUNA_CHAT_URL|ANTHROPIC_API_KEY/);
  });

  it('says ready on Luna Chat when the URL and the internal key are both set', () => {
    process.env.LUNA_CHAT_URL = 'https://x';
    process.env.TG_INTERNAL_KEY = 'k';
    const s = lunaAiStatus();
    expect(s.state).toBe('ready');
    expect(s.via).toBe('luna-chat');
  });

  it('says ready on the direct key alone', () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const s = lunaAiStatus();
    expect(s.state).toBe('ready');
    expect(s.via).toBe('anthropic');
  });

  // THE case. lunaAiConfigured returns true here, viaLunaChat returns without
  // calling anything, and there is no fallback — configured-looking and dead.
  it('catches a URL with no internal key and no fallback', () => {
    process.env.LUNA_CHAT_URL = 'https://x';
    const s = lunaAiStatus();
    expect(s.state).toBe('incomplete');
    expect(s.via).toBeNull();
    expect(s.detail).toMatch(/TG_INTERNAL_KEY/);
    // The optimistic gate disagrees, which is exactly why this exists.
    expect(lunaAiConfigured()).toBe(true);
  });

  it('reports the direct key when the chat URL is unusable but a fallback exists', () => {
    process.env.LUNA_CHAT_URL = 'https://x';
    process.env.ANTHROPIC_API_KEY = 'k';
    const s = lunaAiStatus();
    expect(s.state).toBe('ready');
    expect(s.via).toBe('anthropic');
    expect(s.detail).toMatch(/TG_INTERNAL_KEY/);
  });

  it('mentions the fallback when both backends are available', () => {
    process.env.LUNA_CHAT_URL = 'https://x';
    process.env.TG_INTERNAL_KEY = 'k';
    process.env.ANTHROPIC_API_KEY = 'k';
    expect(lunaAiStatus().detail).toMatch(/fallback/i);
  });
});

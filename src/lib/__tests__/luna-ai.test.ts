import { describe, it, expect } from 'vitest';
import { isRefusal, CANNOT_ANSWER } from '@/lib/luna-ai';

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

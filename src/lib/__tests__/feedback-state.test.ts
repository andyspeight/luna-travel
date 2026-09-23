import { describe, it, expect } from 'vitest';
import { shouldAskForFeedback, ASK_FOR_DAYS } from '@/lib/feedback-state';

/**
 * When to ask how the trip went. The two ways to get this wrong are asking
 * before the trip is over, and asking again after somebody said not now.
 */

const END = '2026-12-04T11:00:00Z';
const at = (iso: string) => new Date(iso).getTime();
const days = (n: number) => at(END) + n * 86_400_000;

describe('shouldAskForFeedback', () => {
  it('does not ask before the trip is over', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: at('2026-11-30T10:00:00Z') })).toBe(false);
  });

  it('does not ask at the very moment it ends', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: at(END) })).toBe(false);
  });

  it('asks once the trip has ended', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: days(1) })).toBe(true);
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: days(5) })).toBe(true);
  });

  // The review's own ask: a request that cannot be put away is a nag.
  it('stops asking once somebody says not now', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'dismissed', now: days(2) })).toBe(false);
  });

  it('stops asking once it has been answered', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'sent', now: days(2) })).toBe(false);
  });

  // Nobody opening the app for next summer wants to be asked about last year.
  it('stops asking once the trip is well in the past', () => {
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: days(ASK_FOR_DAYS) })).toBe(true);
    expect(shouldAskForFeedback({ tripEnd: END, state: 'open', now: days(ASK_FOR_DAYS + 1) })).toBe(false);
  });

  it('says nothing when it cannot tell when the trip ended', () => {
    expect(shouldAskForFeedback({ tripEnd: undefined, state: 'open', now: days(2) })).toBe(false);
    expect(shouldAskForFeedback({ tripEnd: '', state: 'open', now: days(2) })).toBe(false);
    expect(shouldAskForFeedback({ tripEnd: 'not-a-date', state: 'open', now: days(2) })).toBe(false);
  });
});

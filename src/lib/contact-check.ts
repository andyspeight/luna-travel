/**
 * Is this an email address or phone number we can put in front of a traveller?
 *
 * Pure, so the portal form can check as the agent types and the server can
 * check again on save with the same rules.
 */

/** Deliberately loose — this is a sanity check, not an attempt to parse RFC 5322. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

/**
 * A phone number a traveller can dial: digits with the usual punctuation, a
 * leading + allowed, and between 6 and 15 digits (the international maximum).
 */
export function isPhone(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  const digits = t.replace(/\D/g, '').length;
  return /^\+?[0-9 ()\-.]{6,24}$/.test(t) && digits >= 6 && digits <= 15;
}

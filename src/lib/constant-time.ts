import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string equality for comparing secrets (internal keys, cron
 * bearer tokens). Hashes both inputs to a fixed 32-byte digest first, so neither
 * the timing nor the length of the comparison leaks anything about the secret.
 * Use this instead of `===`/`!==` when checking an inbound token against a
 * server-side secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a ?? '').digest();
  const hb = createHash('sha256').update(b ?? '').digest();
  return timingSafeEqual(ha, hb);
}

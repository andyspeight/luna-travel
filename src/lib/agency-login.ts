/**
 * Magic-link tokens for Luna-native agency portal login.
 *
 * A token is a high-entropy random string handed out in a link. We store only
 * its sha256 hash (luna_travel.agency_login_tokens.token_hash), so a database
 * leak never yields a usable link. Consuming a token is a single atomic UPDATE
 * guarded by `used_at is null`, so a link works exactly once even under a
 * double-click / replay race.
 *
 * Delivery is out of band: an operator generates a link in the SSO admin and
 * sends it to the agency's contact (there is no server email yet). A later
 * "email me a link" self-serve path can call createLoginToken directly.
 *
 * Service-role only (getSupabaseAdmin).
 */

import { randomBytes, createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isLunaAgency } from '@/lib/agency-id';

// Operator-generated onboarding links are sent by hand, so they get a generous
// window; the resulting session is what's actually long-lived.
const DEFAULT_TTL_DAYS = 14;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreatedLoginToken {
  /** The raw token — goes in the link, never stored. */
  token: string;
  expiresAt: string;
}

/**
 * Mint a single-use login token for an agency. Only Luna-native agencies
 * (`lt…`) use this path — Control agencies sign in via SSO.
 */
export async function createLoginToken(
  agencyId: string,
  email: string,
  opts?: { ttlDays?: number; createdBy?: string },
): Promise<CreatedLoginToken> {
  if (!isLunaAgency(agencyId)) {
    throw new Error('login tokens are only for Luna-native agencies');
  }
  const raw = randomBytes(32).toString('base64url');
  const ttlDays = opts?.ttlDays && opts.ttlDays > 0 ? Math.min(opts.ttlDays, 30) : DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await getSupabaseAdmin()
    .from('agency_login_tokens')
    .insert({
      agency_id: agencyId,
      email: email.trim().toLowerCase(),
      token_hash: hashToken(raw),
      expires_at: expiresAt,
      created_by: opts?.createdBy ?? null,
    });
  if (error) throw new Error(error.message);

  return { token: raw, expiresAt };
}

/**
 * Look up an unused, unexpired token WITHOUT consuming it, returning the agency
 * it belongs to (or null). Used by the login route to confirm the agency still
 * exists BEFORE the token is burned, so a transient lookup error doesn't kill a
 * valid one-time link — the token is only spent once we're committing the login.
 * This does not weaken single-use: consumeLoginToken's atomic UPDATE remains the
 * sole gate.
 */
export async function peekLoginToken(
  raw: string,
): Promise<{ agencyId: string; email: string } | null> {
  if (!raw || typeof raw !== 'string') return null;
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('agency_login_tokens')
    .select('agency_id, email')
    .eq('token_hash', hashToken(raw))
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { agency_id: string; email: string };
  return { agencyId: row.agency_id, email: row.email };
}

/**
 * Consume a token: validate it is unused and unexpired, mark it used, and
 * return the agency it belongs to. Returns null if the token is unknown,
 * already used, or expired. The UPDATE is atomic on `used_at is null`, so a
 * concurrent second consume returns null.
 */
export async function consumeLoginToken(
  raw: string,
): Promise<{ agencyId: string; email: string } | null> {
  if (!raw || typeof raw !== 'string') return null;
  const nowIso = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('agency_login_tokens')
    .update({ used_at: nowIso })
    .eq('token_hash', hashToken(raw))
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('agency_id, email')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { agency_id: string; email: string };
  return { agencyId: row.agency_id, email: row.email };
}

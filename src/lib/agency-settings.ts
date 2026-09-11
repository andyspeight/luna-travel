/**
 * Per-agency operational settings.
 *
 * Separate from agency-branding on purpose. Branding models "Luna override ??
 * Control ?? default", where clearing an override deletes the row — settings
 * override nothing and must not vanish when somebody resets their branding.
 *
 * Reads are on the traveller reply path, so every failure here is swallowed and
 * treated as "not set": a notification address that cannot be loaded should
 * degrade to the older fallbacks, never break the reply itself.
 */

import { getSupabaseAdmin } from '@/lib/supabase';

export interface AgencySettings {
  /** Where to email the agency when a traveller replies. */
  replyNotifyEmail?: string;
}

/** Deliberately loose — this is a sanity check, not an attempt to parse RFC 5322. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

type SettingsRow = {
  agency_id: string;
  reply_notify_email: string | null;
};

function rowToSettings(row: Partial<SettingsRow> | null | undefined): AgencySettings {
  const email = (row?.reply_notify_email || '').trim();
  return { replyNotifyEmail: isEmail(email) ? email : undefined };
}

/** Settings for one agency (empty object when none, or on any error). */
export async function getAgencySettings(agencyId: string): Promise<AgencySettings> {
  if (!agencyId) return {};
  try {
    const { data } = await getSupabaseAdmin()
      .from('agency_settings')
      .select('agency_id, reply_notify_email')
      .eq('agency_id', agencyId)
      .maybeSingle();
    return rowToSettings(data as SettingsRow | null);
  } catch {
    return {};
  }
}

/**
 * Upsert one agency's settings. Passing an empty/absent address clears it,
 * which is a real choice: it means "go back to working it out automatically".
 */
export async function setAgencySettings(agencyId: string, settings: AgencySettings): Promise<void> {
  const email = (settings.replyNotifyEmail || '').trim();
  const { error } = await getSupabaseAdmin().from('agency_settings').upsert(
    {
      agency_id: agencyId,
      reply_notify_email: isEmail(email) ? email : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id' },
  );
  if (error) throw new Error(error.message);
}

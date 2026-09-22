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
import { toMinutes, type OpeningDay, type SupportHours } from '@/lib/support-hours';

export interface AgencySettings {
  /** Where to email the agency when a traveller replies. */
  replyNotifyEmail?: string;
  /**
   * When the agency is open, and where in the world that is.
   *
   * Absent means the agency has not said, and the traveller app then makes no
   * claim about timing at all. An invented "9 to 5" is worse than silence,
   * because somebody in an airport plans around it.
   */
  supportHours?: SupportHours;
  /** What the agency promises, in its own words, e.g. "within one working day". */
  replyWithin?: string;
}

/** Long enough for a real promise, short enough not to be a paragraph. */
export const MAX_REPLY_WITHIN = 80;

/**
 * Keep only days that describe a real opening.
 *
 * A malformed row is dropped rather than defaulted: a day nobody can parse is
 * a day we do not know about, and the screen should be quiet about it.
 */
export function cleanOpeningDays(input: unknown): OpeningDay[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const out: OpeningDay[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const day = Number(r.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) continue;
    const open = String(r.open ?? '');
    const close = String(r.close ?? '');
    if (!Number.isFinite(toMinutes(open)) || !Number.isFinite(toMinutes(close))) continue;
    if (toMinutes(open) === toMinutes(close)) continue;
    seen.add(day);
    out.push({ day, open, close });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** Is this a zone this runtime can actually resolve? */
export function isTimezone(v: unknown): v is string {
  if (typeof v !== 'string' || !v.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: v.trim() });
    return true;
  } catch {
    return false;
  }
}

/** Deliberately loose — this is a sanity check, not an attempt to parse RFC 5322. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

type SettingsRow = {
  agency_id: string;
  reply_notify_email: string | null;
  support_hours: unknown;
  support_timezone: string | null;
  reply_within: string | null;
};

function rowToSettings(row: Partial<SettingsRow> | null | undefined): AgencySettings {
  const email = (row?.reply_notify_email || '').trim();

  // Hours only count when BOTH the days and the zone survive validation. A
  // set of hours with no timezone cannot be shown honestly to somebody
  // abroad, so it is treated as not stated.
  const days = cleanOpeningDays(row?.support_hours);
  const zone = row?.support_timezone;
  const supportHours =
    days.length && isTimezone(zone) ? { timezone: zone.trim(), days } : undefined;

  const replyWithin = (row?.reply_within || '').trim().slice(0, MAX_REPLY_WITHIN);

  return {
    replyNotifyEmail: isEmail(email) ? email : undefined,
    supportHours,
    replyWithin: replyWithin || undefined,
  };
}

/** Settings for one agency (empty object when none, or on any error). */
export async function getAgencySettings(agencyId: string): Promise<AgencySettings> {
  if (!agencyId) return {};
  try {
    const { data } = await getSupabaseAdmin()
      .from('agency_settings')
      .select('agency_id, reply_notify_email, support_hours, support_timezone, reply_within')
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

  const days = cleanOpeningDays(settings.supportHours?.days);
  const zone = settings.supportHours?.timezone;
  const keepHours = days.length > 0 && isTimezone(zone);

  const within = (settings.replyWithin || '').trim().slice(0, MAX_REPLY_WITHIN);

  const { error } = await getSupabaseAdmin().from('agency_settings').upsert(
    {
      agency_id: agencyId,
      reply_notify_email: isEmail(email) ? email : null,
      // Clearing is a real choice, and it means the app goes back to saying
      // nothing about when somebody will answer.
      support_hours: keepHours ? days : null,
      support_timezone: keepHours ? zone!.trim() : null,
      reply_within: within || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id' },
  );
  if (error) throw new Error(error.message);
}

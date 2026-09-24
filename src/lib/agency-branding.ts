/**
 * Luna Travel's white-label branding layer.
 *
 * Effective branding for an agency is resolved per-field as:
 *
 *     Luna override (luna_travel.agency_branding)  ??  Control client record  ??  defaults
 *
 * so a brand can be pulled from Control, overridden here, or set here outright
 * when Control has none. The admin White-label tab writes to BOTH Luna and
 * Control (kept in sync), but Luna always wins on read — this module is the read
 * + write path for the Luna layer.
 *
 * All access is via the service-role client (the table is service-role only).
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { Agency } from '@/types/booking';
import { parseLogoMeta, type LogoMeta } from '@/lib/logo-look';

export interface BrandingFields {
  appName?: string;
  logoUrl?: string;
  brandPrimaryColour?: string;
  brandAccentColour?: string;
  welcomeMessage?: string;
  /** What the in-app assistant is called. Absent means "Luna". */
  assistantName?: string;
  /** Uploaded home-screen icon. Absent means one is drawn from the app name. */
  iconUrl?: string;
  /** The logo's measured shape and tone (lib/logo-look). */
  logoMeta?: LogoMeta;
}

/** Accept only a plain hex colour (#RGB / #RRGGBB); normalise to #rrggbb. */
export function sanitizeHex(v?: string | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return undefined;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

const clean = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

type BrandingRow = {
  agency_id: string;
  app_name: string | null;
  logo_url: string | null;
  brand_primary_colour: string | null;
  brand_accent_colour: string | null;
  welcome_message: string | null;
  assistant_name?: string | null;
  icon_url?: string | null;
  logo_meta?: unknown;
};

function rowToFields(row: Partial<BrandingRow> | null | undefined): BrandingFields {
  if (!row) return {};
  return {
    appName: clean(row.app_name),
    logoUrl: clean(row.logo_url),
    brandPrimaryColour: sanitizeHex(row.brand_primary_colour),
    brandAccentColour: sanitizeHex(row.brand_accent_colour),
    welcomeMessage: clean(row.welcome_message),
    assistantName: clean(row.assistant_name),
    iconUrl: clean(row.icon_url),
    logoMeta: parseLogoMeta(row.logo_meta) ?? undefined,
  };
}

/** Luna override for one agency (empty object when none / on error). */
export async function getBrandingOverride(agencyId: string): Promise<BrandingFields> {
  if (!agencyId) return {};
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('agency_branding')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();
    return rowToFields(data as BrandingRow | null);
  } catch {
    return {};
  }
}

/** Luna overrides for many agencies, keyed by agency_id. */
export async function getBrandingOverrides(agencyIds: string[]): Promise<Map<string, BrandingFields>> {
  const map = new Map<string, BrandingFields>();
  const ids = agencyIds.filter(Boolean);
  if (!ids.length) return map;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('agency_branding').select('*').in('agency_id', ids);
    for (const row of (data as BrandingRow[]) || []) map.set(row.agency_id, rowToFields(row));
  } catch {
    /* best-effort — callers fall back to Control values */
  }
  return map;
}

/** Per-field effective branding: override wins, else the base (Control) value. */
export function mergeBranding(base: BrandingFields, override: BrandingFields): BrandingFields {
  return {
    appName: override.appName ?? base.appName,
    logoUrl: override.logoUrl ?? base.logoUrl,
    brandPrimaryColour: override.brandPrimaryColour ?? base.brandPrimaryColour,
    brandAccentColour: override.brandAccentColour ?? base.brandAccentColour,
    welcomeMessage: override.welcomeMessage ?? base.welcomeMessage,
    assistantName: override.assistantName ?? base.assistantName,
    iconUrl: override.iconUrl ?? base.iconUrl,
    logoMeta: override.logoMeta ?? base.logoMeta,
  };
}

/**
 * Overlay a Luna override onto a booking's agency in place — only fields the
 * override actually sets. Used on the traveller read path so the app renders
 * effective branding (override ?? whatever Control/the stored payload carried).
 */
export function applyBrandingOverride(agency: Agency, override: BrandingFields): void {
  if (override.appName !== undefined) agency.appName = override.appName;
  if (override.logoUrl !== undefined) agency.logoUrl = override.logoUrl;
  if (override.brandPrimaryColour !== undefined) agency.brandPrimaryColour = override.brandPrimaryColour;
  if (override.brandAccentColour !== undefined) agency.brandAccentColour = override.brandAccentColour;
  if (override.welcomeMessage !== undefined) agency.welcomeMessage = override.welcomeMessage;
  if (override.assistantName !== undefined) agency.assistantName = override.assistantName;
  if (override.iconUrl !== undefined) agency.iconUrl = override.iconUrl;
  // The measurement belongs to the override's logo, so it travels only with it.
  if (override.logoUrl !== undefined) agency.logoMeta = override.logoMeta;
}

/**
 * The row to upsert for an agency's override. A field passed as undefined or
 * empty is stored as NULL — "inherit from Control" for that field.
 *
 * The assistant name and the icon are written only when the caller passes the
 * key at all. The admin White-label tab saves the original five fields and
 * knows nothing of them, and a save there must not quietly rename the agency's
 * assistant back to Luna or take its icon off travellers' home screens.
 */
export function brandingRow(agencyId: string, fields: BrandingFields, now = new Date()): Record<string, string | null> {
  const row: Record<string, string | null> = {
    agency_id: agencyId,
    app_name: clean(fields.appName) ?? null,
    logo_url: clean(fields.logoUrl) ?? null,
    brand_primary_colour: sanitizeHex(fields.brandPrimaryColour) ?? null,
    brand_accent_colour: sanitizeHex(fields.brandAccentColour) ?? null,
    welcome_message: clean(fields.welcomeMessage) ?? null,
    updated_at: now.toISOString(),
  };
  if ('assistantName' in fields) row.assistant_name = clean(fields.assistantName) ?? null;
  if ('iconUrl' in fields) row.icon_url = clean(fields.iconUrl) ?? null;
  if ('logoMeta' in fields) row.logo_meta = (fields.logoMeta ?? null) as unknown as string | null;
  return row;
}

/** Upsert the Luna override for an agency (see brandingRow for what is written). */
export async function setBrandingOverride(agencyId: string, fields: BrandingFields): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('agency_branding')
    .upsert(brandingRow(agencyId, fields), { onConflict: 'agency_id' });
  if (error) throw new Error(error.message);
}

/** Drop the Luna override entirely — the agency reverts to inheriting Control. */
export async function clearBrandingOverride(agencyId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('agency_branding').delete().eq('agency_id', agencyId);
  if (error) throw new Error(error.message);
}

/**
 * Measure a stored logo that has not been measured yet, and save the result.
 *
 * Logos saved before measuring existed (and any whose measurement was lost)
 * are caught here the first time they are shown, once: an unmeasurable logo
 * is saved as "unknown" so it is not fetched again on every page. Returns the
 * override with the measurement in place.
 */
export async function ensureLogoMeta(agencyId: string, override: BrandingFields): Promise<BrandingFields> {
  if (!agencyId || !override.logoUrl || override.logoMeta) return override;
  const { analyzeLogo, isStoredLogoUrl } = await import('@/lib/logo-analyze');
  if (!isStoredLogoUrl(override.logoUrl)) return override;
  const meta = await analyzeLogo(override.logoUrl);
  try {
    await getSupabaseAdmin().from('agency_branding').update({ logo_meta: meta }).eq('agency_id', agencyId);
  } catch {
    /* shown unmeasured this time; measured again next time */
  }
  return { ...override, logoMeta: meta };
}

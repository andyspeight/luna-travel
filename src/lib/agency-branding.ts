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

export interface BrandingFields {
  appName?: string;
  logoUrl?: string;
  brandPrimaryColour?: string;
  brandAccentColour?: string;
  welcomeMessage?: string;
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
};

function rowToFields(row: Partial<BrandingRow> | null | undefined): BrandingFields {
  if (!row) return {};
  return {
    appName: clean(row.app_name),
    logoUrl: clean(row.logo_url),
    brandPrimaryColour: sanitizeHex(row.brand_primary_colour),
    brandAccentColour: sanitizeHex(row.brand_accent_colour),
    welcomeMessage: clean(row.welcome_message),
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
}

/**
 * Upsert the Luna override for an agency. A field passed as undefined/empty is
 * stored as NULL — i.e. "inherit from Control" for that field.
 */
export async function setBrandingOverride(agencyId: string, fields: BrandingFields): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('agency_branding').upsert(
    {
      agency_id: agencyId,
      app_name: clean(fields.appName) ?? null,
      logo_url: clean(fields.logoUrl) ?? null,
      brand_primary_colour: sanitizeHex(fields.brandPrimaryColour) ?? null,
      brand_accent_colour: sanitizeHex(fields.brandAccentColour) ?? null,
      welcome_message: clean(fields.welcomeMessage) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id' },
  );
  if (error) throw new Error(error.message);
}

/** Drop the Luna override entirely — the agency reverts to inheriting Control. */
export async function clearBrandingOverride(agencyId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('agency_branding').delete().eq('agency_id', agencyId);
  if (error) throw new Error(error.message);
}

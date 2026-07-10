/**
 * Luna-native agency store (luna_travel.agencies) + shaping helpers.
 *
 * Control agencies are read from Control's HTTP API (see api/admin/agencies).
 * This module owns the Luna-native side and shapes its rows into the SAME object
 * the admin UI expects, so the agencies list/detail can present both sources
 * uniformly. A `source` field ('control' | 'luna') distinguishes them.
 *
 * Service-role only.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { newLunaAgencyId, isLunaAgency } from '@/lib/agency-id';

export type AgencySource = 'control' | 'luna';

export interface LunaAgencyRow {
  id: string;
  name: string;
  trading_name: string | null;
  contact_email: string | null;
  contact_name: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewLunaAgencyInput {
  name: string;
  tradingName?: string;
  contactEmail?: string;
  contactName?: string;
  phone?: string;
  website?: string;
  status?: string;
  createdBy?: string;
}

/** Shape a Luna-native row into the agency object the admin UI uses. Branding
 *  fields are left blank here — the agencies route overlays the effective
 *  branding (from luna_travel.agency_branding) the same way it does for Control. */
export function lunaRowToAgency(row: LunaAgencyRow) {
  return {
    id: row.id,
    source: 'luna' as AgencySource,
    name: row.trading_name || row.name || '',
    legalName: row.name || '',
    tier: 'Luna-native',
    status: (row.status || '').toLowerCase(),
    contact: row.contact_email || '',
    contactName: row.contact_name || '',
    website: row.website || '',
    phone: row.phone || '',
    // Luna-native agencies are off-platform only — no Travelify integration.
    travelifyAppId: '',
    travelifySiteId: '',
    apiKeySet: false,
    apiKeyLast4: '',
    // Branding placeholders; overlaid with the effective branding downstream.
    appName: '',
    brandPrimaryColour: '',
    brandAccentColour: '',
    welcomeMessage: '',
    logoUrl: '',
    goLive: row.created_at || null,
    lastLogin: null,
    travellers: null as number | null,
    activeTrips: null as number | null,
    deviceInstalls: null as number | null,
    lastSync: null as string | null,
  };
}

export async function createLunaAgency(input: NewLunaAgencyInput): Promise<LunaAgencyRow> {
  const supabase = getSupabaseAdmin();
  const id = newLunaAgencyId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('agencies')
    .insert({
      id,
      name: input.name,
      trading_name: input.tradingName ?? null,
      contact_email: input.contactEmail ?? null,
      contact_name: input.contactName ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      status: input.status ?? 'live',
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  return data as LunaAgencyRow;
}

export async function getLunaAgency(id: string): Promise<LunaAgencyRow | null> {
  if (!isLunaAgency(id)) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('agencies').select('*').eq('id', id).maybeSingle();
    return (data as LunaAgencyRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function listLunaAgencies(): Promise<LunaAgencyRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('agencies').select('*').order('name', { ascending: true });
    return (data as LunaAgencyRow[] | null) ?? [];
  } catch {
    return [];
  }
}

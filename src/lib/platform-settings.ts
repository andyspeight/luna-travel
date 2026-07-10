/**
 * Platform-level settings (luna_travel.platform_settings) — kill switches and
 * system defaults set from the admin Settings page and enforced across the app.
 *
 * Reads FAIL OPEN: any error returns the safe defaults (nothing paused), so a
 * settings-store hiccup can never take down onboarding, alerts, or the app.
 *
 * Service-role only.
 */

import { getSupabaseAdmin } from '@/lib/supabase';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
}

export interface PlatformSettings {
  onboardingPaused: boolean; // pause new traveller onboarding (invite redemption)
  flightAlertsPaused: boolean; // pause registering new flight-alert subscriptions
  maintenance: MaintenanceState; // traveller-app maintenance banner
  inviteExpiryDays: number; // default invite lifetime
}

export const SETTING_KEYS = {
  onboardingPaused: 'onboarding_paused',
  flightAlertsPaused: 'flight_alerts_paused',
  maintenance: 'maintenance',
  inviteExpiryDays: 'invite_expiry_days',
} as const;

export const DEFAULT_SETTINGS: PlatformSettings = {
  onboardingPaused: false,
  flightAlertsPaused: false,
  maintenance: { enabled: false, message: '' },
  inviteExpiryDays: 30,
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function asNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function asMaintenance(v: unknown): MaintenanceState {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return {
      enabled: typeof o.enabled === 'boolean' ? o.enabled : false,
      message: typeof o.message === 'string' ? o.message : '',
    };
  }
  return { enabled: false, message: '' };
}

/** Read all platform settings, merged over defaults. Never throws. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const { data, error } = await getSupabaseAdmin().from('platform_settings').select('key, value');
    if (error) return DEFAULT_SETTINGS;
    const map = new Map(((data ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]));
    return {
      onboardingPaused: asBool(map.get(SETTING_KEYS.onboardingPaused), DEFAULT_SETTINGS.onboardingPaused),
      flightAlertsPaused: asBool(map.get(SETTING_KEYS.flightAlertsPaused), DEFAULT_SETTINGS.flightAlertsPaused),
      maintenance: asMaintenance(map.get(SETTING_KEYS.maintenance)),
      inviteExpiryDays: asNum(map.get(SETTING_KEYS.inviteExpiryDays), DEFAULT_SETTINGS.inviteExpiryDays),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Upsert a single setting. Value is stored as JSONB. */
export async function setPlatformSetting(key: string, value: unknown, updatedBy: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('platform_settings')
    .upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy } as any,
      { onConflict: 'key' },
    );
  if (error) throw new Error(error.message);
}

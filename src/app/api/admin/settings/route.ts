/**
 * /api/admin/settings — platform settings + live status board for the admin
 * Settings page. requireAdmin.
 *
 *   GET  — current settings + a live health board (Supabase, AeroDataBox,
 *          Control, env config, cron).
 *   POST — update one setting: { key, value }. Key must be a known setting;
 *          value is validated per key. Audited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { probeAeroDataBox } from '@/lib/aerodatabox';
import {
  getPlatformSettings,
  setPlatformSetting,
  SETTING_KEYS,
  type MaintenanceState,
} from '@/lib/platform-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';

async function controlReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(CONTROL_HOST, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return res.status > 0;
  } catch {
    return false;
  }
}

async function supabaseOk(): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdmin().from('platform_settings').select('key', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Run auth alongside the (bounded) health probes rather than before them, so
  // the route's wall-clock is the slowest single call, not their sum. The
  // caller is already validated by the edge middleware before this handler
  // runs; requireAdmin here is defence in depth, so probing in parallel is safe.
  const [claims, settings, supabase, ada, control] = await Promise.all([
    requireAdmin(req as unknown as Request),
    getPlatformSettings(),
    supabaseOk(),
    probeAeroDataBox(),
    controlReachable(),
  ]);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    AIRTABLE_KEY: !!process.env.AIRTABLE_KEY,
    TG_ENCRYPTION_KEY: !!process.env.TG_ENCRYPTION_KEY,
    TG_INTERNAL_KEY: !!process.env.TG_INTERNAL_KEY,
    AERODATABOX_API_KEY: !!process.env.AERODATABOX_API_KEY,
    AERODATABOX_WEBHOOK_TOKEN: !!process.env.AERODATABOX_WEBHOOK_TOKEN,
    LUNA_TRAVEL_PUBLIC_URL: !!process.env.LUNA_TRAVEL_PUBLIC_URL,
    CRON_SECRET: !!process.env.CRON_SECRET,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
  };
  const envSet = Object.values(env).filter(Boolean).length;

  return NextResponse.json({
    ok: true,
    settings,
    status: {
      supabase,
      aerodatabox: { reachable: ada.reachable, status: ada.status },
      control,
      cron: !!process.env.CRON_SECRET,
      env,
      envSet,
      envTotal: Object.keys(env).length,
    },
    checkedAt: new Date().toISOString(),
  });
}

const KNOWN_KEYS = new Set<string>(Object.values(SETTING_KEYS));

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let body: { key?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  if (!KNOWN_KEYS.has(key)) {
    return NextResponse.json({ error: 'unknown_key' }, { status: 400 });
  }

  // Validate/coerce the value per key.
  let value: unknown;
  if (key === SETTING_KEYS.onboardingPaused || key === SETTING_KEYS.flightAlertsPaused) {
    if (typeof body.value !== 'boolean') return NextResponse.json({ error: 'bad_value' }, { status: 400 });
    value = body.value;
  } else if (key === SETTING_KEYS.inviteExpiryDays) {
    const n = Number(body.value);
    if (!Number.isFinite(n) || n < 1 || n > 365) return NextResponse.json({ error: 'bad_value', message: 'Expiry must be 1–365 days' }, { status: 400 });
    value = Math.floor(n);
  } else if (key === SETTING_KEYS.maintenance) {
    const v = (body.value ?? {}) as Record<string, unknown>;
    const m: MaintenanceState = {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : false,
      message: typeof v.message === 'string' ? v.message.slice(0, 280) : '',
    };
    value = m;
  } else {
    return NextResponse.json({ error: 'unknown_key' }, { status: 400 });
  }

  try {
    await setPlatformSetting(key, value, claims.email);
  } catch (err) {
    console.error('[admin/settings] save failed', (err as Error).message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  // Who changed what + when is recorded natively on platform_settings
  // (updated_by / updated_at) — no separate audit row needed.
  return NextResponse.json({ ok: true, settings: await getPlatformSettings() });
}

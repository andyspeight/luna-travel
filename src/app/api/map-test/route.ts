/**
 * GET /api/map-test   ⚠️ TEMPORARY — remove before production (with the spike)
 *
 * Runs a real Travelify order through mapTravelifyBooking() and returns:
 *   - the diagnostics `report` (what mapped, what was empty, what was skipped)
 *   - the mapped `booking` (the exact object the PWA would render)
 *   - the `rawBooking` (so we can compare field-by-field)
 *
 * This is the review tool for hardening the mapper against many real bookings
 * of varying shape, before any of it touches the live PWA.
 *
 * Auth: shared secret (SPIKE_SECRET), same as /api/spike-booking — works on
 * the *.vercel.app preview URL where the admin cookie can't reach.
 *
 * Usage:
 *   /api/map-test?secret=YOURSECRET&ref=ABC123&email=lead@example.com&depart=YYYY-MM-DD
 *
 * Lives on the `live-wiring` branch only.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { mapTravelifyBooking } from '@/lib/map-travelify-booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AIRTABLE_BASE = 'appAYzWZxvK6qlwXK';
const INTEGRATIONS_TABLE = 'tblpzQpwmcTvUeHcF';
const DEMO_INTEGRATION_RECORD_ID = 'rec6TnQI0Pz8PyrGs';
const TRAVELIFY_API = 'https://api.travelify.io/account/order';

const IF = {
  AppId: 'fldCXwCixuvqN2HMy',
  ApiKeyEncrypted: 'fldpb4JQRSuot0Gg2',
};

function decrypt(payload: string): string {
  const raw = process.env.TG_ENCRYPTION_KEY;
  if (!raw) throw new Error('TG_ENCRYPTION_KEY not set');
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('TG_ENCRYPTION_KEY must be 64 hex chars');
  const key = Buffer.from(raw, 'hex');
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 12 + 16 + 1) throw new Error('Encrypted payload too short');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function fetchDemoIntegration(): Promise<{ appId: string; apiKey: string }> {
  const key = process.env.AIRTABLE_KEY;
  if (!key) throw new Error('AIRTABLE_KEY not set');
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${INTEGRATIONS_TABLE}/${DEMO_INTEGRATION_RECORD_ID}?returnFieldsByFieldId=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Airtable lookup failed (${res.status})`);
  const record = await res.json();
  const fields = record?.fields || {};
  const appId = fields[IF.AppId];
  const apiKeyEncrypted = fields[IF.ApiKeyEncrypted];
  if (!appId || !apiKeyEncrypted) throw new Error('Demo integration record missing fields');
  return { appId: String(appId), apiKey: decrypt(apiKeyEncrypted) };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const secret = searchParams.get('secret') ?? '';
  const expected = process.env.SPIKE_SECRET ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'spike_disabled', detail: 'SPIKE_SECRET env var is not set.' },
      { status: 503 },
    );
  }
  if (!secret || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const ref = searchParams.get('ref')?.trim();
  const email = searchParams.get('email')?.trim();
  const depart = searchParams.get('depart')?.trim();
  if (!ref || !email || !depart) {
    return NextResponse.json(
      { error: 'missing_params', usage: '/api/map-test?secret=...&ref=...&email=...&depart=YYYY-MM-DD' },
      { status: 400 },
    );
  }

  // Fetch the real order
  let creds: { appId: string; apiKey: string };
  try {
    creds = await fetchDemoIntegration();
  } catch (e) {
    return NextResponse.json({ stage: 'credentials', error: (e as Error).message }, { status: 500 });
  }

  let res: Response;
  let bodyText: string;
  try {
    res = await fetch(TRAVELIFY_API, {
      method: 'POST',
      headers: {
        Authorization: `Token ${creds.appId}:${creds.apiKey}`,
        'Content-Type': 'application/json',
        Origin: 'https://www.travelgenix.io',
      },
      body: JSON.stringify({ emailAddress: email, departDate: depart, orderRef: ref }),
      signal: AbortSignal.timeout(15_000),
    });
    bodyText = await res.text();
  } catch (e) {
    return NextResponse.json({ stage: 'travelify_fetch', error: (e as Error).message }, { status: 502 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { stage: 'parse', httpStatus: res.status, rawText: bodyText.slice(0, 2000) },
      { status: 200 },
    );
  }

  // Travelify not-found shape
  if (raw && (raw.code === '404' || raw.code === 404)) {
    return NextResponse.json({ stage: 'not_found', httpStatus: res.status, rawBooking: raw }, { status: 200 });
  }

  // Run the mapper — never let a mapper exception 500 the review tool.
  let mapped: ReturnType<typeof mapTravelifyBooking> | null = null;
  let mapperError: string | null = null;
  try {
    mapped = mapTravelifyBooking(raw, { reference: ref });
  } catch (e) {
    mapperError = (e as Error).message + '\n' + ((e as Error).stack ?? '');
  }

  return NextResponse.json(
    {
      stage: mapperError ? 'mapper_threw' : 'success',
      usedAppId: creds.appId,
      httpStatus: res.status,
      mapperError,
      report: mapped?.report ?? null,
      booking: mapped?.booking ?? null,
      rawBooking: raw,
    },
    { status: 200 },
  );
}

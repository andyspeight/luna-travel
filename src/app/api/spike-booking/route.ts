/**
 * GET /api/spike-booking   ⚠️ TEMPORARY SPIKE — remove before production
 *
 * Purpose: see the FULL raw shape of a real Travelify booking, so we can map
 * it onto the rich `Booking` type the PWA renders (src/types/booking.ts).
 *
 * The live `lookupBooking` helper deliberately keeps only 7 fields (enough to
 * create a traveller row). This spike keeps EVERYTHING, so we can see what's
 * available before wiring documents, flights, hotels and extras to the UI.
 *
 * WHY IT'S NOT UNDER /api/admin:
 *   The admin API gate validates the central `tg_session` cookie, which is
 *   scoped to .travelify.io. On a *.vercel.app preview URL that cookie is
 *   never sent, so an admin-gated route can't be reached there at all. This
 *   spike instead protects itself with a shared secret passed in the URL —
 *   simple, works on any domain, and fine for a temporary read-only probe.
 *
 * Safety:
 *   - Protected by the SPIKE_SECRET env var. No secret / wrong secret = 401.
 *   - Read-only. Touches no database, no mock data, no existing flow.
 *   - Lives on the `live-wiring` branch only. Deleted before merge.
 *
 * Setup (one-time): add a Vercel env var SPIKE_SECRET to any value you like,
 * e.g. a long random string. Then call:
 *
 *   /api/spike-booking?secret=YOURSECRET&ref=ABC123&email=lead@example.com&depart=YYYY-MM-DD
 *
 *   secret  — must match the SPIKE_SECRET env var
 *   ref     — the customer-facing booking reference
 *   email   — the lead passenger email on the booking
 *   depart  — departure date, YYYY-MM-DD
 *
 * It reports:
 *   - which Travelify app/account the demo credentials resolved to
 *   - the HTTP status Travelify returned
 *   - the FULL parsed JSON body (or raw text if it didn't parse)
 *   - every top-level key + every key seen inside items[], grouped by product
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

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
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error('TG_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable lookup failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const record = await res.json();
  const fields = record?.fields || {};
  const appId = fields[IF.AppId];
  const apiKeyEncrypted = fields[IF.ApiKeyEncrypted];
  if (!appId || !apiKeyEncrypted) throw new Error('Demo integration record missing AppId or ApiKey');
  return { appId: String(appId), apiKey: decrypt(apiKeyEncrypted) };
}

/** Timing-safe string compare so the secret check can't be probed by timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function collectKeys(arr: Array<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  for (const obj of arr) {
    if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) seen.add(k);
  }
  return [...seen].sort();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // ── Auth: shared secret, not the cross-domain admin cookie ──
  const secret = searchParams.get('secret') ?? '';
  const expected = process.env.SPIKE_SECRET ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'spike_disabled', detail: 'SPIKE_SECRET env var is not set on this deployment.' },
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
      {
        error: 'missing_params',
        usage: '/api/spike-booking?secret=...&ref=ABC123&email=lead@example.com&depart=YYYY-MM-DD',
      },
      { status: 400 },
    );
  }

  // 1. Resolve credentials (demo integration record)
  let creds: { appId: string; apiKey: string };
  try {
    creds = await fetchDemoIntegration();
  } catch (e) {
    return NextResponse.json({ stage: 'credentials', error: (e as Error).message }, { status: 500 });
  }

  // 2. Call Travelify (server-side, WITH the required headers)
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
    return NextResponse.json(
      { stage: 'travelify_fetch', usedAppId: creds.appId, error: (e as Error).message },
      { status: 502 },
    );
  }

  // 3. Parse + introspect
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      {
        stage: 'parse',
        usedAppId: creds.appId,
        httpStatus: res.status,
        note: 'Response was not JSON. Raw text below (first 2000 chars).',
        rawText: bodyText.slice(0, 2000),
      },
      { status: 200 },
    );
  }

  const items = Array.isArray(parsed?.items)
    ? (parsed!.items as Array<Record<string, unknown>>)
    : [];

  const itemsByProduct: Record<string, string[]> = {};
  for (const item of items) {
    const product = typeof item.product === 'string' ? item.product : 'unknown';
    if (!itemsByProduct[product]) itemsByProduct[product] = [];
    itemsByProduct[product].push(...Object.keys(item));
  }
  for (const p of Object.keys(itemsByProduct)) {
    itemsByProduct[p] = [...new Set(itemsByProduct[p])].sort();
  }

  return NextResponse.json(
    {
      stage: 'success',
      usedAppId: creds.appId,
      httpStatus: res.status,
      shapeReport: {
        topLevelKeys: parsed ? Object.keys(parsed).sort() : [],
        itemCount: items.length,
        productTypesPresent: Object.keys(itemsByProduct).sort(),
        keysSeenPerProduct: itemsByProduct,
        allItemKeys: collectKeys(items),
      },
      rawBooking: parsed,
    },
    { status: 200 },
  );
}

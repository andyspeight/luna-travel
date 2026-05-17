/**
 * Travelify integration helper.
 *
 * Mirrors the pattern used by tg-widgets/api/retrieve-order.js — credentials
 * live in the ClientIntegrations Airtable table, encrypted with AES-256-GCM.
 *
 * For v1 we only support the demo bypass path: any call with
 * useDemoIntegration=true pulls the pinned demo Travelify record
 * (rec6TnQI0Pz8PyrGs) and uses its credentials. Real per-agency credential
 * lookup will be added when we have the agency_id → client_email mapping in
 * place.
 *
 * Env required:
 *   AIRTABLE_KEY         — same key the widgets project uses
 *   TG_ENCRYPTION_KEY    — same key the widgets project uses (must match,
 *                          or decryption fails)
 *
 * The Travelify call requires an Origin header. Without it, the API
 * silently returns 401 "Missing or invalid application credentials". This
 * has bitten us before — do not remove that header.
 */

import crypto from 'node:crypto';

const AIRTABLE_BASE = 'appAYzWZxvK6qlwXK';
const INTEGRATIONS_TABLE = 'tblpzQpwmcTvUeHcF';
const DEMO_INTEGRATION_RECORD_ID = 'rec6TnQI0Pz8PyrGs';
const TRAVELIFY_API = 'https://api.travelify.io/account/order';

// Integrations table field IDs
const IF = {
  AppId:           'fldCXwCixuvqN2HMy',
  ApiKeyEncrypted: 'fldpb4JQRSuot0Gg2',
};

// ───────── AES-256-GCM decrypt (matches _crypto.js in tg-widgets) ─────────

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

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

// ───────── Airtable: fetch demo integration record ─────────

async function fetchDemoIntegration(): Promise<{ appId: string; apiKey: string } | null> {
  const key = process.env.AIRTABLE_KEY;
  if (!key) throw new Error('AIRTABLE_KEY not set');

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${INTEGRATIONS_TABLE}/${DEMO_INTEGRATION_RECORD_ID}?returnFieldsByFieldId=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable lookup failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const record = await res.json();
  const fields = record?.fields || {};
  const appId = fields[IF.AppId];
  const apiKeyEncrypted = fields[IF.ApiKeyEncrypted];
  if (!appId || !apiKeyEncrypted) return null;

  let apiKey: string;
  try {
    apiKey = decrypt(apiKeyEncrypted);
  } catch (e) {
    console.error('[travelify] Demo key decryption failed:', (e as Error).message);
    return null;
  }
  return { appId: String(appId), apiKey };
}

// ───────── Travelify call ─────────

export type TravelifyBooking = {
  id: number;
  status: string;
  customerEmail: string | null;
  customerFirstname: string | null;
  customerSurname: string | null;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
};

export type TravelifyResult =
  | { ok: true; booking: TravelifyBooking }
  | { ok: false; reason: 'not_found' | 'config' | 'server' };

/**
 * Look up a booking from Travelify.
 *
 * For v1, always uses the demo integration (we don't yet have agency →
 * credentials mapping for the redemption flow). When real per-agency
 * lookup is added later, this signature will gain a clientEmail parameter
 * and the demo bypass will be gated on a flag.
 */
export async function lookupBooking(input: {
  bookingRef: string;
  email: string;
  departureDate: string;
}): Promise<TravelifyResult> {
  // Fetch credentials (demo integration only for now)
  let creds: { appId: string; apiKey: string } | null;
  try {
    creds = await fetchDemoIntegration();
  } catch (e) {
    console.error('[travelify] credential fetch failed:', (e as Error).message);
    return { ok: false, reason: 'config' };
  }
  if (!creds) {
    console.error('[travelify] No demo integration available');
    return { ok: false, reason: 'config' };
  }

  let res: Response;
  try {
    res = await fetch(TRAVELIFY_API, {
      method: 'POST',
      headers: {
        Authorization: `Token ${creds.appId}:${creds.apiKey}`,
        'Content-Type': 'application/json',
        Origin: 'https://www.travelgenix.io',
      },
      body: JSON.stringify({
        emailAddress: input.email,
        departDate: input.departureDate,
        orderRef: input.bookingRef,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    console.error('[travelify] fetch failed:', (e as Error).message);
    return { ok: false, reason: 'server' };
  }

  const text = await res.text();

  if (res.status === 404) return { ok: false, reason: 'not_found' };
  if (!res.ok) {
    console.error('[travelify] non-ok response:', res.status, text.slice(0, 300));
    return { ok: false, reason: 'not_found' }; // generic to client
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_found' };
  }

  // Travelify documents { code: '404' } shape for not-found
  if (raw && (raw.code === '404' || raw.code === 404)) {
    return { ok: false, reason: 'not_found' };
  }

  // Extract just the fields we need for the traveller row
  const items = Array.isArray(raw.items) ? raw.items as Array<Record<string, unknown>> : [];

  // Earliest startDate across items = traveller's actual departure
  let earliestStart: string | null = null;
  let latestEnd: string | null = null;
  let destination: string | null = null;

  for (const item of items) {
    const startDate = typeof item.startDate === 'string' ? item.startDate : null;
    if (startDate) {
      if (!earliestStart || startDate < earliestStart) earliestStart = startDate;
    }
    // Naive "destination": first accommodation's city
    if (item.product === 'Accommodation' && item.dataObject && typeof item.dataObject === 'object') {
      const data = item.dataObject as Record<string, unknown>;
      const loc = data.location as Record<string, unknown> | undefined;
      if (loc?.city && typeof loc.city === 'string' && !destination) {
        destination = loc.city;
      }
    }
    // Latest end date — use startDate + duration for accommodation, or fallback to startDate
    const duration = typeof item.duration === 'number' ? item.duration : 0;
    if (startDate && duration) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + duration);
      const end = d.toISOString().slice(0, 10);
      if (!latestEnd || end > latestEnd) latestEnd = end;
    }
  }

  return {
    ok: true,
    booking: {
      id: typeof raw.id === 'number' ? raw.id : 0,
      status: typeof raw.status === 'string' ? raw.status : 'unknown',
      customerEmail: typeof raw.customerEmail === 'string' ? raw.customerEmail : null,
      customerFirstname: typeof raw.customerFirstname === 'string' ? raw.customerFirstname : null,
      customerSurname: typeof raw.customerSurname === 'string' ? raw.customerSurname : null,
      departureDate: earliestStart,
      returnDate: latestEnd,
      destination,
    },
  };
}

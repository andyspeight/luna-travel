/**
 * Travelify live-lookup helpers for the traveller PWA.
 *
 * Two responsibilities, kept separate so each is testable:
 *   1. lookupKeysForSession — the JWT carries travellerId + bookingRef but NOT
 *      the email/departure-date that Travelify needs. We read those from the
 *      traveller row that was created at redemption time.
 *   2. fetchTravelifyRaw — call Travelify with the demo integration credentials
 *      and return the raw order object (or null on not-found). Mirrors the
 *      credential + header pattern in src/lib/travelify.ts; the header set is
 *      identical (the Origin header is mandatory or Travelify 401s silently).
 *
 * These exist alongside src/lib/travelify.ts (which returns only the 7-field
 * traveller-row summary). This helper returns the FULL raw object so the
 * mapper can build a complete Booking.
 */

import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SessionClaims } from '@/lib/jwt';

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

/**
 * Resolve the email + departure date needed for a Travelify lookup, from the
 * traveller row created at redemption. Returns null if the row can't be found
 * (caller should then fall back to mock rather than error).
 */
export async function lookupKeysForSession(
  claims: SessionClaims,
): Promise<{ email: string; departureDate: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('travellers')
    .select('email, departure_date, booking_ref')
    .eq('id', claims.travellerId)
    .maybeSingle();

  if (error) throw new Error(`travellers lookup failed: ${error.message}`);
  if (!data) return null;

  const email = typeof data.email === 'string' ? data.email : null;
  const departureDate =
    typeof data.departure_date === 'string' ? data.departure_date.slice(0, 10) : null;
  if (!email || !departureDate) return null;

  return { email, departureDate };
}

/**
 * Call Travelify and return the full raw order object, or null on not-found.
 * Throws only on config/network errors (caller decides how to degrade).
 */
export async function fetchTravelifyRaw(input: {
  bookingRef: string;
  email: string;
  departureDate: string;
}): Promise<Record<string, unknown> | null> {
  const creds = await fetchDemoIntegration();

  const res = await fetch(TRAVELIFY_API, {
    method: 'POST',
    headers: {
      Authorization: `Token ${creds.appId}:${creds.apiKey}`,
      'Content-Type': 'application/json',
      Origin: 'https://www.travelgenix.io', // mandatory — do not remove
    },
    body: JSON.stringify({
      emailAddress: input.email,
      departDate: input.departureDate,
      orderRef: input.bookingRef,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Travelify ${res.status}: ${text.slice(0, 200)}`);

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw && (raw.code === '404' || raw.code === 404)) return null;
  return raw;
}

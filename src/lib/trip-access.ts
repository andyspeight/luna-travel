/**
 * "Email me my trip link" — self-service access recovery.
 *
 * A traveller who has lost their invite link enters their email address on the
 * traveller app's landing page. If that address matches a trip we hold, we mail
 * them the link (plus a QR for opening on another device). Nothing is granted
 * at the form: possession of the mailbox IS the authentication, which is why
 * this is safe in a way that "enter your booking reference and surname" is not.
 *
 * It also sidesteps the multi-tenant lookup problem. A bare booking reference
 * is ambiguous — the same reference can exist in two agencies, and nothing in
 * it says which Travelify app to query. The email does not have that problem:
 * every invite and traveller row already carries agency_id, so the agency (and
 * therefore the App ID) is resolved from our own data.
 *
 * Privacy rule that shapes everything here: the caller must NEVER learn whether
 * an address matched. The API returns an identical response either way, so no
 * function in this module may report "found" vs "not found" to the caller.
 */

import { createHash } from 'crypto';
import QRCode from 'qrcode';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getBrandingOverride } from '@/lib/agency-branding';
import { getLunaAgency } from '@/lib/agencies';
import { isLunaAgency } from '@/lib/agency-id';
import { travellerUrl } from '@/lib/origins';
import { sendEmail, type EmailAttachment } from '@/lib/email';

/** Max trips listed in one email, newest first. */
const MAX_TRIPS = 5;
/** Trips that ended longer ago than this are not offered. */
const PAST_TRIP_GRACE_DAYS = 60;
const INVITE_TTL_DAYS = 30;

// Rate limits — this endpoint sends mail to an address the caller supplies.
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

export function hashValue(v: string): string {
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

export function isEmailLike(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Record this attempt and report whether it is within the limits. Returns false
 * when the caller should be silently dropped — the API still responds success.
 */
export async function checkRateLimit(emailHash: string, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // Inside the try: getSupabaseAdmin() throws when the service-role env is
    // missing or malformed, and that must fail closed like any other error
    // rather than escaping as a 500.
    const supabase = getSupabaseAdmin();
    const [byEmail, byIp] = await Promise.all([
      supabase
        .from('trip_access_requests')
        .select('id', { count: 'exact', head: true })
        .eq('email_hash', emailHash)
        .gte('created_at', since),
      ipHash
        ? supabase
            .from('trip_access_requests')
            .select('id', { count: 'exact', head: true })
            .eq('ip_hash', ipHash)
            .gte('created_at', since)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if ((byEmail.count ?? 0) >= MAX_PER_EMAIL_PER_HOUR) return false;
    if ((byIp.count ?? 0) >= MAX_PER_IP_PER_HOUR) return false;

    await supabase.from('trip_access_requests').insert({ email_hash: emailHash, ip_hash: ipHash });

    // Opportunistic prune so the table stays small; failure is harmless.
    void supabase
      .from('trip_access_requests')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return true;
  } catch (e) {
    // Fail CLOSED: if we cannot prove the request is within limits, do not send.
    console.error('[trip-access] rate limit check failed', e instanceof Error ? e.message : e);
    return false;
  }
}

export interface TripMatch {
  agencyId: string;
  bookingRef: string;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
}

/**
 * Every trip we hold for this address, grouped by agency.
 *
 * Searches BOTH tables on purpose: `travellers` rows only appear once someone
 * has opened their app, so a traveller who never managed to open the link —
 * exactly the person this feature is for — exists only in `invites`.
 */
export async function findTripsForEmail(email: string): Promise<Map<string, TripMatch[]>> {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - PAST_TRIP_GRACE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [inviteRes, travellerRes] = await Promise.all([
    supabase
      .from('invites')
      .select('agency_id, booking_ref, destination, departure_date, return_date')
      .ilike('email', email)
      .neq('status', 'revoked')
      .limit(50),
    supabase
      .from('travellers')
      .select('agency_id, booking_ref, destination, departure_date, return_date')
      .ilike('email', email)
      .limit(50),
  ]);

  if (inviteRes.error) console.error('[trip-access] invite lookup', inviteRes.error.message);
  if (travellerRes.error) console.error('[trip-access] traveller lookup', travellerRes.error.message);

  const rows = [...(inviteRes.data ?? []), ...(travellerRes.data ?? [])] as Array<{
    agency_id: string | null;
    booking_ref: string | null;
    destination: string | null;
    departure_date: string | null;
    return_date: string | null;
  }>;

  // De-duplicate: the same trip usually appears in both tables.
  const byKey = new Map<string, TripMatch>();
  for (const r of rows) {
    const agencyId = (r.agency_id || '').trim();
    const bookingRef = (r.booking_ref || '').trim();
    if (!agencyId || !bookingRef) continue;
    // Drop trips that finished long ago — the link still works, but a list of
    // ancient holidays is noise.
    const ended = r.return_date || r.departure_date;
    if (ended && ended < cutoff) continue;

    const key = `${agencyId}::${bookingRef}`;
    const existing = byKey.get(key);
    if (existing) {
      // Prefer whichever row actually carries trip detail.
      existing.destination ||= r.destination;
      existing.departureDate ||= r.departure_date;
      existing.returnDate ||= r.return_date;
      continue;
    }
    byKey.set(key, {
      agencyId,
      bookingRef,
      destination: r.destination,
      departureDate: r.departure_date,
      returnDate: r.return_date,
    });
  }

  const sorted = [...byKey.values()].sort((a, b) =>
    (b.departureDate || '').localeCompare(a.departureDate || ''),
  );

  const grouped = new Map<string, TripMatch[]>();
  for (const t of sorted.slice(0, MAX_TRIPS)) {
    const list = grouped.get(t.agencyId) ?? [];
    list.push(t);
    grouped.set(t.agencyId, list);
  }
  return grouped;
}

/**
 * A usable invite for this trip — reusing an existing one where possible so the
 * traveller's old link and this one stay the same, and minting a fresh one when
 * the only invite has expired.
 */
export async function resolveInviteId(trip: TripMatch, email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: usable } = await supabase
    .from('invites')
    .select('id, expires_at, status')
    .eq('agency_id', trip.agencyId)
    .eq('booking_ref', trip.bookingRef)
    .neq('status', 'revoked')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const found = (usable ?? [])[0] as { id: string } | undefined;
  if (found?.id) return found.id;

  const { data: created, error } = await supabase
    .from('invites')
    .insert({
      agency_id: trip.agencyId,
      booking_ref: trip.bookingRef,
      email,
      departure_date: trip.departureDate,
      return_date: trip.returnDate,
      destination: trip.destination,
      status: 'pending',
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      created_by: 'trip-access',
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[trip-access] could not mint invite', error?.message);
    return null;
  }
  return (created as { id: string }).id;
}

/**
 * How the agency should appear in the inbox. Branding's app name first (it is
 * what the agency chose their travellers should see), then the Luna-native
 * record. Control-sourced agencies carry their name in the session claims
 * rather than in our database, so an agency that has never set branding falls
 * back to a neutral label rather than a wrong one.
 */
export async function agencyDisplay(agencyId: string): Promise<{ name: string; replyTo?: string }> {
  try {
    const branding = await getBrandingOverride(agencyId);
    if (branding.appName?.trim()) {
      const out: { name: string; replyTo?: string } = { name: branding.appName.trim() };
      if (isLunaAgency(agencyId)) {
        const row = await getLunaAgency(agencyId);
        if (row?.contact_email) out.replyTo = row.contact_email;
      }
      return out;
    }
    if (isLunaAgency(agencyId)) {
      const row = await getLunaAgency(agencyId);
      const name = (row?.trading_name || row?.name || '').trim();
      if (name) return { name, replyTo: row?.contact_email || undefined };
    }
  } catch (e) {
    console.error('[trip-access] agency display lookup', e instanceof Error ? e.message : e);
  }
  return { name: 'Your travel agent' };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tripLine(t: TripMatch): string {
  const dates = [fmtDate(t.departureDate), fmtDate(t.returnDate)].filter(Boolean).join(' – ');
  return [t.destination || t.bookingRef, dates].filter(Boolean).join(' · ');
}

/**
 * Build and send one agency's email. The QR is attached inline rather than as a
 * data: URI because Gmail strips those — and it sits BELOW the button, because
 * a QR is unscannable on the phone that is displaying it. The button is the
 * primary action; the QR is for "I'm reading this on my laptop".
 */
export async function sendTripAccessEmail(
  to: string,
  agencyId: string,
  trips: Array<{ trip: TripMatch; inviteId: string }>,
): Promise<void> {
  if (!trips.length) return;
  const { name: agencyName, replyTo } = await agencyDisplay(agencyId);

  const primary = trips[0];
  const primaryUrl = travellerUrl(`/install?invite=${primary.inviteId}`, '');
  // travellerUrl falls back to a relative path when no origin is configured,
  // which would be a dead link in an inbox. Refuse rather than send one.
  if (!/^https?:\/\//i.test(primaryUrl)) {
    console.error('[trip-access] NEXT_PUBLIC_TRAVELLER_ORIGIN is not set — refusing to send a relative link');
    return;
  }

  const attachments: EmailAttachment[] = [];
  try {
    const dataUrl = await QRCode.toDataURL(primaryUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0d1836', light: '#ffffff' },
    });
    attachments.push({
      content: dataUrl.split(',')[1],
      filename: 'trip-qr.png',
      type: 'image/png',
      disposition: 'inline',
      contentId: 'tripqr',
    });
  } catch (e) {
    console.error('[trip-access] QR generation failed', e instanceof Error ? e.message : e);
  }

  const others = trips.slice(1);
  const othersHtml = others.length
    ? `<p style="margin:26px 0 8px;font-size:13px;color:#475569;">Your other trips:</p>
       <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.7;">
         ${others
           .map(
             (o) =>
               `<li><a href="${escapeHtml(
                 travellerUrl(`/install?invite=${o.inviteId}`, ''),
               )}" style="color:#0096b7;">${escapeHtml(tripLine(o.trip))}</a></li>`,
           )
           .join('')}
       </ul>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">${escapeHtml(agencyName)}</p>
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#0f172a;font-weight:700;">Here's your trip</h1>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#475569;">
            Tap below to open <strong style="color:#0f172a;">${escapeHtml(tripLine(primary.trip))}</strong> on your phone — your flights, documents and everything else in one place.
          </p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b;">
            Once it opens you can add it to your home screen, so it's one tap away for the whole trip.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
            <tr><td style="border-radius:12px;background:#00b4d8;">
              <a href="${escapeHtml(primaryUrl)}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Open my trip</a>
            </td></tr>
          </table>
          ${
            attachments.length
              ? `<p style="margin:0 0 10px;font-size:13px;color:#64748b;">Reading this on a computer? Scan with your phone's camera:</p>
                 <img src="cid:tripqr" alt="QR code to open your trip" width="150" height="150" style="display:block;border:1px solid #e2e8f0;border-radius:10px;" />`
              : ''
          }
          ${othersHtml}
          <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
            You're receiving this because someone asked us to send this trip's link to ${escapeHtml(to)}. If that wasn't you, you can safely ignore this email — nothing has changed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `${agencyName}`,
    '',
    `Here's your trip: ${tripLine(primary.trip)}`,
    '',
    `Open it here: ${primaryUrl}`,
    '',
    ...(others.length
      ? ['Your other trips:', ...others.map((o) => `- ${tripLine(o.trip)}: ${travellerUrl(`/install?invite=${o.inviteId}`, '')}`), '']
      : []),
    `You're receiving this because someone asked us to send this trip's link to ${to}.`,
    "If that wasn't you, you can safely ignore this email — nothing has changed.",
  ].join('\n');

  await sendEmail({
    to,
    subject: `Your trip${primary.trip.destination ? ` to ${primary.trip.destination}` : ''}`,
    text,
    html,
    fromName: agencyName,
    ...(replyTo ? { replyTo: { email: replyTo, name: agencyName } } : {}),
    attachments,
  });
}

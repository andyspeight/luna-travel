/**
 * Telling the agent something needs them.
 *
 * The traveller side is now instant — messages and flight changes push to their
 * phone. The agent side was not: a reply only surfaced if somebody happened to
 * open the portal. A customer messaging at 9pm from an airport about a transfer
 * that has not arrived is exactly the case where that matters, so replies now
 * email the agent.
 *
 * Email rather than push on purpose: the portal is an ordinary web page, not an
 * installed app, so push there is both the most work and the least reliable —
 * whereas agents already live in their inbox.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { getLunaAgency } from '@/lib/agencies';
import { isLunaAgency } from '@/lib/agency-id';
import { getBrandingOverride } from '@/lib/agency-branding';
import { portalUrl } from '@/lib/origins';
import { sendEmail } from '@/lib/email';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Enough of an address to recognise in a log, not enough to be a mailing list.
 * Worth having: a send that succeeds is otherwise completely silent, so there
 * is no way to tell "went to the wrong agent" from "never ran".
 */
function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - head.length, 1))}@${domain}`;
}

/**
 * Who to tell at the agency.
 *
 * A Luna-native agency has a contact email on its own record. A Control-sourced
 * one does not — its details live in Control and only reach us inside a session
 * — so we fall back to the agent who actually sent this traveller their access.
 * That is arguably the better address anyway: it is the person who owns the
 * relationship rather than a generic inbox.
 */
export async function resolveAgentEmail(
  agencyId: string,
  bookingRef: string | null,
): Promise<string | null> {
  try {
    if (isLunaAgency(agencyId)) {
      const row = await getLunaAgency(agencyId);
      const email = (row?.contact_email || '').trim();
      if (email) return email;
    }

    const supabase = getSupabaseAdmin();
    let q = supabase
      .from('invites')
      .select('created_by, created_at')
      .eq('agency_id', agencyId)
      // created_by is not always a person. Several paths stamp a sentinel:
      // 'trip-access' (self-service recovery), 'manual-booking', 'demo-seed'.
      // None of them contain an @, so the database can rule them out — and it
      // has to, because taking the single most recent row and then rejecting
      // it meant one recovery email permanently shadowed the real agent. That
      // row is always the newest, so the agency would silently stop being
      // told about replies from the moment a traveller first recovered a trip.
      .like('created_by', '%@%')
      .order('created_at', { ascending: false })
      .limit(5);
    if (bookingRef) q = q.eq('booking_ref', bookingRef);

    const { data } = await q;
    for (const row of (data ?? []) as { created_by?: string }[]) {
      const candidate = (row.created_by || '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return candidate;
    }

    // Booking-specific lookup found nothing — try the agency's most recent
    // invite from any booking before giving up.
    if (bookingRef) return resolveAgentEmail(agencyId, null);
  } catch (e) {
    console.error('[agent-notify] could not resolve agent email', e instanceof Error ? e.message : e);
  }
  return null;
}

export interface ReplyNotification {
  agencyId: string;
  travellerName: string | null;
  bookingRef: string | null;
  destination: string | null;
  body: string;
}

/**
 * Email the agent that a traveller has replied. Never throws — the reply itself
 * is already saved and visible in the portal, so a mail failure must not turn a
 * successful reply into an error for the traveller.
 */
export async function notifyAgentOfReply(input: ReplyNotification): Promise<void> {
  try {
    const to = await resolveAgentEmail(input.agencyId, input.bookingRef);
    if (!to) {
      console.warn('[agent-notify] no agent email for agency', input.agencyId);
      return;
    }

    const branding = await getBrandingOverride(input.agencyId).catch(() => ({ appName: undefined }));
    const who = input.travellerName?.trim() || 'A traveller';
    const ref = input.bookingRef ? ` (${input.bookingRef})` : '';
    const link = portalUrl('/agency/messages', '');
    const excerpt = input.body.length > 600 ? `${input.body.slice(0, 600)}…` : input.body;

    const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:18px;padding:30px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">${escapeHtml(branding.appName || 'Luna Travel')}</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">
            ${escapeHtml(who)} replied${escapeHtml(ref)}
          </h1>
          ${input.destination ? `<p style="margin:0 0 14px;font-size:13px;color:#64748b;">Trip: ${escapeHtml(input.destination)}</p>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #00b4d8;background:#f8fafc;border-radius:0 10px 10px 0;margin:0 0 22px;">
            <tr><td style="padding:14px 16px;font-size:14.5px;line-height:1.6;color:#0f172a;white-space:pre-line;">${escapeHtml(excerpt)}</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:12px;background:#1b2b5b;">
              <a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:12px;">Reply in the portal</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
            Replying to this email won't reach your traveller — open the portal so your reply lands in their app.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = [
      `${who} replied${ref}`,
      input.destination ? `Trip: ${input.destination}` : '',
      '',
      excerpt,
      '',
      `Reply in the portal: ${link}`,
      '',
      "Replying to this email won't reach your traveller — open the portal so your reply lands in their app.",
    ]
      .filter((l) => l !== '')
      .join('\n');

    await sendEmail({
      to,
      subject: `${who} replied${ref}`,
      text,
      html,
      fromName: branding.appName?.trim() || 'Luna Travel',
    });

    console.log('[agent-notify] reply email sent', {
      to: maskEmail(to),
      agencyId: input.agencyId,
      bookingRef: input.bookingRef,
    });
  } catch (e) {
    console.error('[agent-notify] reply email failed', e instanceof Error ? e.message : e);
  }
}

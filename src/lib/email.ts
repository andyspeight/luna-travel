/**
 * Transactional email — SendGrid v3.
 *
 * Server-only. Plain fetch against the REST API rather than @sendgrid/mail:
 * one endpoint, no extra dependency, and no surprises in the edge/node split.
 *
 * Sending identity: the FROM address is always on my-booking.co (the traveller
 * domain), with the AGENCY's name as the display name and their address as
 * reply-to. That keeps the inbox line reading as the agency — which is the
 * whole white-label promise — without asking every agency to set up DKIM on
 * their own domain.
 *
 * SETUP (see docs/DOMAINS.md):
 *   - SENDGRID_API_KEY          the API key (Mail Send permission only)
 *   - TRIP_ACCESS_FROM_EMAIL    optional; defaults to trips@my-booking.co
 *   my-booking.co must be domain-authenticated in SendGrid (SPF/DKIM CNAMEs
 *   added to Cloudflare) or mail will fail DMARC and land in spam.
 */

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_FROM = 'trips@my-booking.co';

export interface EmailAttachment {
  /** Base64-encoded file content. */
  content: string;
  filename: string;
  type: string;
  /** Set both to reference the image from the HTML as <img src="cid:ID">. */
  disposition?: 'inline' | 'attachment';
  contentId?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Display name shown in the inbox — the agency's name. */
  fromName?: string;
  replyTo?: { email: string; name?: string };
  attachments?: EmailAttachment[];
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY);
}

/**
 * Send one email. Never throws — returns ok/false with a reason, because the
 * public callers must not change their response based on mail success (that
 * would leak whether an address matched).
 */
export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.error('[email] SENDGRID_API_KEY is not set — cannot send');
    return { ok: false, error: 'not_configured' };
  }

  const from = (process.env.TRIP_ACCESS_FROM_EMAIL || DEFAULT_FROM).trim();

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: input.to }] }],
    from: { email: from, ...(input.fromName ? { name: input.fromName } : {}) },
    subject: input.subject,
    // SendGrid requires text/plain before text/html.
    content: [
      { type: 'text/plain', value: input.text },
      { type: 'text/html', value: input.html },
    ],
  };

  if (input.replyTo?.email) {
    body.reply_to = { email: input.replyTo.email, ...(input.replyTo.name ? { name: input.replyTo.name } : {}) };
  }
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      type: a.type,
      disposition: a.disposition ?? 'attachment',
      ...(a.contentId ? { content_id: a.contentId } : {}),
    }));
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 202) return { ok: true };
    // SendGrid puts the reason in the body; log it but never surface it.
    const detail = await res.text().catch(() => '');
    console.error('[email] send failed', res.status, detail.slice(0, 500));
    return { ok: false, error: `sendgrid_${res.status}` };
  } catch (e) {
    console.error('[email] send threw', e instanceof Error ? e.message : e);
    return { ok: false, error: 'network' };
  }
}

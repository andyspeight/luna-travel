/**
 * Audit logging — single entry point for every endpoint that emits an event.
 *
 * Design principle: audit is observational, never gating. If the audit
 * insert fails (Supabase outage, etc.), the calling operation must still
 * succeed. We log the failure to console for our own monitoring but
 * return without throwing.
 *
 * Events currently emitted:
 *   - admin.signin / admin.signin_failed / admin.signout
 *   - invite.created
 *   - invite.redeemed
 *
 * To add a new event type:
 *   1. Add the value to the audit_event_type enum (new migration)
 *   2. Add the string to AuditEventType below
 *   3. Call logAuditEvent() from the relevant endpoint
 */

import { getSupabaseAdmin } from './supabase';
import type { NextRequest } from 'next/server';

export type AuditEventType =
  | 'admin.signin'
  | 'admin.signin_failed'
  | 'admin.signout'
  | 'invite.created'
  | 'invite.redeemed'
  | 'document.uploaded'
  | 'document.deleted'
  | 'hero.uploaded'
  | 'hero.removed'
  | 'content.updated'
  | 'storage.purged';

export type AuditLogInput = {
  eventType: AuditEventType;
  actor: string;                // email, 'traveller', or 'system'
  targetId?: string | null;     // invite ID, etc.
  targetLabel?: string | null;  // human-readable: "Coast & Crown / DEMO81297"
  metadata?: Record<string, unknown> | null;
};

/**
 * Log an audit event. Never throws.
 *
 * Returns whether the row was actually written, which most callers can ignore
 * — `void logAuditEvent(...)` is still correct for anything where the audit is
 * observational and must not block the operation.
 *
 * Callers where the trail is part of the deliverable should await it and act on
 * false. /api/admin/storage-cleanup does, because it destroys customers' files
 * and "we removed them but cannot tell you when" is worth saying out loud.
 *
 * WHY THIS RETURNS ANYTHING. It used to swallow failures entirely. Three event
 * types — hero.uploaded, hero.removed, content.updated — were in this union for
 * months without ever being added to the Postgres enum, so every one of those
 * inserts was rejected and discarded in silence. Nobody noticed, because
 * nothing could. An audit trail with holes in it is worse than none, because
 * you trust it.
 *
 * If a write fails right after an enum value is added, suspect PostgREST's
 * schema cache rather than the migration: it caches enum types, so a value that
 * SQL accepts can still be rejected through the API until the cache reloads.
 * `notify pgrst, 'reload schema';` forces it.
 */
export async function logAuditEvent(input: AuditLogInput): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('audit_events')
      .insert({
        event_type: input.eventType,
        actor: input.actor,
        target_id: input.targetId ?? null,
        target_label: input.targetLabel ?? null,
        metadata: input.metadata ?? null,
      });
    if (error) {
      console.error('[audit] insert failed:', error.message, 'for event', input.eventType);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[audit] threw:', (e as Error).message, 'for event', input.eventType);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Request context helpers — extract IP and user-agent shorthand from
// an incoming Next request. The full user-agent string is huge and
// rarely useful in audit logs; we shorten to "Chrome on Mac", "iPhone
// Safari", etc. for the common cases.
// ─────────────────────────────────────────────────────────────

export function getRequestIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

export function shortUserAgent(req: NextRequest): string {
  const ua = req.headers.get('user-agent') || '';
  if (!ua) return 'unknown';
  // Order matters — iPhone reports Safari + Mobile, so test mobile first
  if (/iPhone/.test(ua)) return /CriOS/.test(ua) ? 'Chrome on iPhone' : 'Safari on iPhone';
  if (/iPad/.test(ua)) return 'Safari on iPad';
  if (/Android/.test(ua)) return /Chrome/.test(ua) ? 'Chrome on Android' : 'Browser on Android';
  if (/Windows/.test(ua)) {
    if (/Edg\//.test(ua)) return 'Edge on Windows';
    if (/Chrome/.test(ua)) return 'Chrome on Windows';
    if (/Firefox/.test(ua)) return 'Firefox on Windows';
    return 'Browser on Windows';
  }
  if (/Macintosh/.test(ua)) {
    if (/Edg\//.test(ua)) return 'Edge on Mac';
    if (/Chrome/.test(ua)) return 'Chrome on Mac';
    if (/Firefox/.test(ua)) return 'Firefox on Mac';
    if (/Safari/.test(ua)) return 'Safari on Mac';
    return 'Browser on Mac';
  }
  if (/Linux/.test(ua)) return 'Browser on Linux';
  return 'Other';
}

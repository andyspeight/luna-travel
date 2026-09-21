-- Add the audit event types the enum was missing.
--
-- The TypeScript union in src/lib/audit.ts has carried three values the
-- database enum never had: hero.uploaded, hero.removed and content.updated.
-- logAuditEvent catches and logs rather than throwing, so every hero upload,
-- hero removal and content update has been failing to write its audit row in
-- complete silence. An audit trail with holes in it is worse than none, because
-- you trust it.
--
-- storage.purged is new, for /api/cron/storage-cleanup. That cron is the only
-- process in the system that destroys a customer's file, so "when did that go"
-- needs to have an answer.
--
-- Additive and idempotent: adding an enum value invalidates nothing.

alter type luna_travel.audit_event_type add value if not exists 'hero.uploaded';
alter type luna_travel.audit_event_type add value if not exists 'hero.removed';
alter type luna_travel.audit_event_type add value if not exists 'content.updated';
alter type luna_travel.audit_event_type add value if not exists 'storage.purged';

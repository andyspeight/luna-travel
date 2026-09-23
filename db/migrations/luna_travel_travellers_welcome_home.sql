-- The Welcome-home notification: sent once, the week after a trip ends.
--
-- welcome_home_sent_at is what makes "once" true. /api/cron/welcome-home
-- claims it (sets it where it is still null) BEFORE sending, so two runs that
-- overlap cannot both notify the same traveller; a send that reaches no device
-- hands the claim back so the next day's run can try again.
--
-- push.welcome_home is the audit row for each run that sent something — the
-- only notification the platform sends on its own initiative rather than an
-- agent's or a flight's, so "who did we message, and when" should have an
-- answer.
--
-- Additive and idempotent.

alter table luna_travel.travellers
  add column if not exists welcome_home_sent_at timestamptz;

comment on column luna_travel.travellers.welcome_home_sent_at is
  'When the Welcome-home push was sent. Claimed before sending so it goes once. Null = not sent.';

alter type luna_travel.audit_event_type add value if not exists 'push.welcome_home';

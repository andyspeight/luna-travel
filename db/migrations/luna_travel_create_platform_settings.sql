-- luna_travel.platform_settings — platform-level admin settings.
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-07-10.
--
-- Key/value JSONB store for platform kill switches and system defaults set from
-- the admin Settings page (onboarding pause, flight-alert pause, maintenance
-- banner, default invite expiry, …). One logical row per key. Reads fail OPEN
-- (defaults) so a settings-store hiccup can never break a traveller request.
--
-- Service-role access only (RLS enabled, no policies).

create table if not exists luna_travel.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table luna_travel.platform_settings enable row level security;

comment on table luna_travel.platform_settings is
  'Platform-level admin settings (kill switches, system defaults) as key/value JSONB. Service-role access only (RLS on, no policies).';

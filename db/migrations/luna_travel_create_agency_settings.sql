-- luna_travel.agency_settings — per-agency operational settings.
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-09-11 via
-- the Supabase migration API. Kept here for reproducibility.
--
-- Deliberately NOT part of agency_branding. That table models "Luna override ??
-- Control ?? default", where a NULL column means "inherit from Control" and
-- clearing the override deletes the whole row. None of that applies here: an
-- agency's notification address overrides nothing and is not owned by Control,
-- and it must survive somebody resetting their branding.
--
-- agency_id is whatever id the agency is keyed by — a Control record id
-- (recXXX), a Luna-native id (ltXXX), or a legacy one — so this works for
-- Control-sourced agencies, which have no row in luna_travel.agencies at all.
--
-- Service-role access only (RLS enabled, no policies).

create table if not exists luna_travel.agency_settings (
  agency_id text primary key,
  reply_notify_email text,
  updated_at timestamptz not null default now()
);

alter table luna_travel.agency_settings enable row level security;

comment on table luna_travel.agency_settings is
  'Per-agency operational settings, one row per agency (agency_id = Control recXXX, Luna ltXXX, or legacy). Separate from agency_branding, which models Control inheritance. Service-role only.';

comment on column luna_travel.agency_settings.reply_notify_email is
  'Where to email the agency when a traveller replies. NULL falls back to the agency contact email, then to whoever last sent this traveller their access link.';

-- luna_travel.agency_branding — Luna Travel's own white-label branding layer.
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-07-10 via
-- the Supabase migration API. Kept here for reproducibility.
--
-- Effective branding for an agency is resolved per-field as:
--     Luna override (this table)  ??  Control client record  ??  Luna defaults
-- so an agency's brand can be pulled from Control, overridden here, or (when
-- Control has none) set here outright. A NULL column means "inherit from
-- Control" for that field. One row per agency (agency_id = the Control record
-- id, recXXX). Service-role access only (RLS enabled, no policies).

create table if not exists luna_travel.agency_branding (
  agency_id text primary key,
  app_name text,
  logo_url text,
  brand_primary_colour text,
  brand_accent_colour text,
  welcome_message text,
  updated_at timestamptz not null default now()
);

alter table luna_travel.agency_branding enable row level security;

comment on table luna_travel.agency_branding is 'Luna Travel white-label branding overrides, one row per agency (agency_id = Control recXXX). Effective branding = this override ?? Control ?? defaults; NULL column = inherit from Control. Service-role only.';

-- luna_travel.agencies — Luna-native agencies (non-Travelgenix clients, stage 2).
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-07-10 via
-- the Supabase migration API. Kept here for reproducibility.
--
-- An agency in Luna Travel comes from one of two sources:
--   - Control (Travelgenix): a Clients record, id `rec…` — the source of truth
--     for Travelgenix clients, read via Control's HTTP API.
--   - Luna-native (this table): an agency created directly in Luna, id `lt…`,
--     for clients that are NOT on Travelgenix/Travelify. Off-platform bookings
--     only. Branding lives in luna_travel.agency_branding (keyed by this id).
--
-- Service-role access only (RLS enabled, no policies).

create table if not exists luna_travel.agencies (
  id text primary key,
  name text not null,
  trading_name text,
  contact_email text,
  contact_name text,
  phone text,
  website text,
  status text not null default 'live',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table luna_travel.agencies enable row level security;

comment on table luna_travel.agencies is 'Luna-native agencies (non-Travelgenix clients, id lt…). Control agencies (rec…) live in Control, not here. Off-platform bookings only. Service-role access only.';

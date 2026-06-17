-- luna_travel.sync_events — per-booking Travelify sync outcomes for the admin
-- Sync monitor. Applied to the production Supabase (Travelgenix CRM project)
-- on 2026-06-17 via the Supabase migration API. Kept here for reproducibility.
--
-- Service-role access only (RLS enabled, no policies — the app reads/writes via
-- the service-role client in getSupabaseAdmin()). Written by src/lib/sync.ts.

create table if not exists luna_travel.sync_events (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null,
  booking_ref text not null,
  traveller_id uuid references luna_travel.travellers(id) on delete set null,
  status text not null check (status in ('success','partial','failed')),
  detail text,
  error_code text,
  duration_ms integer,
  documents_added integer not null default 0,
  source text not null default 'cron' check (source in ('cron','manual','redeem')),
  synced_at timestamptz not null default now()
);

create index if not exists sync_events_synced_at_idx on luna_travel.sync_events (synced_at desc);
create index if not exists sync_events_agency_idx on luna_travel.sync_events (agency_id, synced_at desc);

alter table luna_travel.sync_events enable row level security;

comment on table luna_travel.sync_events is 'Per-booking Travelify sync outcomes for the admin Sync monitor. Written by lib/sync.ts (cron sweep + manual re-sync). Service-role access only.';

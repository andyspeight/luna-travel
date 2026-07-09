-- luna_travel.reviews — post-trip traveller reviews (rating + optional comment).
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-07-09 via
-- the Supabase migration API. Kept here for reproducibility.
--
-- Service-role access only (RLS enabled, no policies — the app reads/writes via
-- the service-role client in getSupabaseAdmin()). Written by
-- src/app/api/traveller/review/route.ts, scoped to the lt_session traveller.
-- One review per traveller per booking (re-submitting updates it).

create table if not exists luna_travel.reviews (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references luna_travel.travellers(id) on delete cascade,
  agency_id text not null,
  booking_ref text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  share_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (traveller_id, booking_ref)
);

create index if not exists reviews_agency_created_idx on luna_travel.reviews (agency_id, created_at desc);

alter table luna_travel.reviews enable row level security;

comment on table luna_travel.reviews is 'Post-trip traveller reviews (rating + comment). Written by /api/traveller/review, scoped to the lt_session traveller. One row per (traveller_id, booking_ref). Service-role access only.';

-- luna_travel.bookings — off-platform bookings (manual entry / PDF import) that
-- are NOT held in Travelify. Applied to the production Supabase (Travelgenix CRM
-- project) on 2026-06-17 via the Supabase migration API. Kept here for
-- reproducibility.
--
-- `payload` is the Booking type the PWA renders (built via lib/stored-booking ->
-- orderToBooking). The traveller fetch and invite redemption read these back by
-- (agency_id, reference). Service-role access only (RLS on, no policies).

create table if not exists luna_travel.bookings (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null,
  reference text not null,
  source text not null default 'manual' check (source in ('manual','pdf')),
  lead_email text,
  lead_name text,
  destination text,
  country_code text,
  departure_date date,
  return_date date,
  payload jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_agency_ref_unique unique (agency_id, reference)
);

create index if not exists bookings_agency_ref_idx on luna_travel.bookings (agency_id, reference);

alter table luna_travel.bookings enable row level security;

comment on table luna_travel.bookings is 'Off-platform bookings (manual entry / PDF import) not held in Travelify. payload is the Booking type the PWA renders. Service-role access only.';

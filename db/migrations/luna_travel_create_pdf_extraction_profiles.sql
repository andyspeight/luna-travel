-- luna_travel.pdf_extraction_profiles — per-agency "training" for PDF import.
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-06-18 via
-- the Supabase migration API. Kept here for reproducibility.
--
-- Holds admin-editable extraction `hints` plus a rolling set of confirmed-correct
-- example bookings (captured when an admin reviews and saves an IMPORTED booking).
-- lib/booking-extract injects these into the extraction call so a repeat client's
-- layout is read consistently — the "training" loop. Agency-scoped (one profile
-- per agency for now); each example carries a detected `source` label so the same
-- table can later segment per-template. Service-role access only (RLS on, no
-- policies).

create table if not exists luna_travel.pdf_extraction_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null,
  label text,
  hints text not null default '',
  examples jsonb not null default '[]'::jsonb,
  bookings_learned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pdf_extraction_profiles_agency_unique unique (agency_id)
);

alter table luna_travel.pdf_extraction_profiles enable row level security;

comment on table luna_travel.pdf_extraction_profiles is 'Per-agency PDF-import training: admin hints + confirmed-correct example bookings, injected into extraction. Service-role access only.';

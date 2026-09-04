-- Agency-authored content pages shown in the traveller app ("Before you
-- travel", "Itinerary", "Find your way around"). One row per (agency,
-- booking, page); booking_ref '' means agency-level DEFAULT content, which
-- the traveller API falls back to for before-you-travel when the booking has
-- no page of its own. items is an ordered jsonb array whose shape depends on
-- the page (accordion entries, or map places) — validated server-side before
-- every write (travelgenix-security rule 3).
--
-- Service-role access only: RLS on, no policies, like the other luna_travel
-- tables.

create table if not exists luna_travel.trip_content (
  id          uuid primary key default gen_random_uuid(),
  agency_id   text not null,
  booking_ref text not null default '',
  page        text not null check (page in ('before-you-travel', 'itinerary', 'find-your-way')),
  items       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint trip_content_unique unique (agency_id, booking_ref, page)
);

create index if not exists trip_content_agency_idx  on luna_travel.trip_content (agency_id);
create index if not exists trip_content_booking_idx on luna_travel.trip_content (agency_id, booking_ref);

alter table luna_travel.trip_content enable row level security;

drop trigger if exists trip_content_set_updated_at on luna_travel.trip_content;
create trigger trip_content_set_updated_at
  before update on luna_travel.trip_content
  for each row execute function luna_travel.set_updated_at();

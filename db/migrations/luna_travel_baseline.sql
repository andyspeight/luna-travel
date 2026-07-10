-- Luna Travel — baseline schema (luna_travel schema).
--
-- Reconstructed on 2026-07-10 from the live `luna_travel` schema so a fresh
-- environment is reproducible from the repo. These tables predate the point at
-- which per-migration files started being tracked; the later additions
-- (agencies, agency_branding, bookings, reviews, sync_events,
-- pdf_extraction_profiles) each have their own create file alongside this one.
--
-- Idempotent: safe to re-run against the existing prod database (enum creation
-- is guarded; tables/indexes use IF NOT EXISTS). RLS is enabled with NO
-- policies, so every table is deny-all except the service-role client
-- (getSupabaseAdmin()), which is the only code path that touches them.

create schema if not exists luna_travel;

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type luna_travel.traveller_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.device_install_status as enum ('not_installed', 'installed', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.invite_status as enum ('pending', 'redeemed', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.document_category as enum ('voucher', 'ticket', 'itinerary', 'insurance', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.message_direction as enum ('agency_to_traveller', 'traveller_to_agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.message_priority as enum ('info', 'important', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.message_category as enum ('agent', 'flight', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.delivery_status as enum ('pending', 'delivered', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.flight_status_code as enum (
    'Scheduled', 'CheckIn', 'Boarding', 'GateClosed', 'Departed', 'Delayed',
    'Approaching', 'Landed', 'Cancelled', 'Diverted', 'CancelledUncertain', 'Unknown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.flight_watch_state as enum ('pending', 'active', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type luna_travel.audit_event_type as enum (
    'admin.signin', 'admin.signin_failed', 'admin.signout',
    'invite.created', 'invite.redeemed', 'document.uploaded', 'document.deleted'
  );
exception when duplicate_object then null; end $$;

-- ── travellers ───────────────────────────────────────────────────────────────
create table if not exists luna_travel.travellers (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             text not null,
  booking_ref           text not null,
  email                 text not null,
  lead_passenger_name   text,
  departure_date        date,
  return_date           date,
  destination           text,
  status                luna_travel.traveller_status not null default 'active',
  device_install_status luna_travel.device_install_status not null default 'unknown',
  push_token            text,
  last_seen_at          timestamptz,
  created_at            timestamptz not null default now(),
  first_opened_at       timestamptz,
  last_opened_at        timestamptz,
  open_count            integer not null default 0,
  constraint travellers_agency_booking_unique unique (agency_id, booking_ref)
);
create index if not exists travellers_agency_id_idx      on luna_travel.travellers (agency_id);
create index if not exists travellers_booking_ref_idx    on luna_travel.travellers (booking_ref);
create index if not exists travellers_departure_date_idx on luna_travel.travellers (departure_date);
create index if not exists travellers_destination_idx    on luna_travel.travellers (destination);
create index if not exists travellers_email_idx          on luna_travel.travellers (email);
create index if not exists travellers_status_idx         on luna_travel.travellers (status);
alter table luna_travel.travellers enable row level security;

-- ── invites ──────────────────────────────────────────────────────────────────
create table if not exists luna_travel.invites (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             text not null,
  booking_ref           text,
  email                 text,
  departure_date        date,
  status                luna_travel.invite_status not null default 'pending',
  expires_at            timestamptz not null default (now() + interval '30 days'),
  created_at            timestamptz not null default now(),
  created_by            text,
  redeemed_at           timestamptz,
  redeemed_traveller_id uuid,
  destination           text,
  return_date           date,
  lead_passenger_name   text,
  party_count           integer,
  first_viewed_at       timestamptz,
  constraint invites_redeemed_traveller_fk
    foreign key (redeemed_traveller_id) references luna_travel.travellers(id) on delete set null
);
create index if not exists invites_agency_id_idx  on luna_travel.invites (agency_id);
create index if not exists invites_expires_at_idx  on luna_travel.invites (expires_at) where (status = 'pending');
create index if not exists invites_status_idx      on luna_travel.invites (status) where (status = 'pending');
alter table luna_travel.invites enable row level security;

-- ── documents ────────────────────────────────────────────────────────────────
create table if not exists luna_travel.documents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     text not null,
  booking_ref   text,
  traveller_id  uuid references luna_travel.travellers(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  category      luna_travel.document_category not null default 'other',
  uploaded_by   text,
  uploaded_at   timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists documents_active_idx      on luna_travel.documents (agency_id) where (deleted_at is null);
create index if not exists documents_agency_id_idx    on luna_travel.documents (agency_id);
create index if not exists documents_booking_ref_idx  on luna_travel.documents (booking_ref);
create index if not exists documents_traveller_id_idx on luna_travel.documents (traveller_id);
create index if not exists documents_uploaded_at_idx  on luna_travel.documents (uploaded_at desc);
alter table luna_travel.documents enable row level security;

-- ── messages ─────────────────────────────────────────────────────────────────
create table if not exists luna_travel.messages (
  id          uuid primary key default gen_random_uuid(),
  agency_id   text not null,
  direction   luna_travel.message_direction not null default 'agency_to_traveller',
  subject     text,
  body        text not null,
  attachments jsonb not null default '[]'::jsonb,
  priority    luna_travel.message_priority not null default 'info',
  targeting   jsonb not null default '{}'::jsonb,
  sent_by     text,
  sent_at     timestamptz not null default now(),
  category    luna_travel.message_category not null default 'agent'
);
create index if not exists messages_agency_id_idx on luna_travel.messages (agency_id);
create index if not exists messages_priority_idx  on luna_travel.messages (priority) where (priority = any (array['important'::luna_travel.message_priority, 'urgent'::luna_travel.message_priority]));
create index if not exists messages_sent_at_idx   on luna_travel.messages (sent_at desc);
alter table luna_travel.messages enable row level security;

-- ── message_recipients ───────────────────────────────────────────────────────
create table if not exists luna_travel.message_recipients (
  message_id      uuid not null references luna_travel.messages(id) on delete cascade,
  traveller_id    uuid not null references luna_travel.travellers(id) on delete cascade,
  delivered_at    timestamptz,
  read_at         timestamptz,
  delivery_status luna_travel.delivery_status not null default 'pending',
  primary key (message_id, traveller_id)
);
create index if not exists message_recipients_traveller_id_idx on luna_travel.message_recipients (traveller_id);
create index if not exists message_recipients_unread_idx       on luna_travel.message_recipients (traveller_id) where (read_at is null);
alter table luna_travel.message_recipients enable row level security;

-- ── trip_flights ─────────────────────────────────────────────────────────────
create table if not exists luna_travel.trip_flights (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           text not null,
  booking_ref         text not null,
  flight_leg_id       text not null,
  carrier_code        text not null,
  flight_number       text not null,
  dep_date_local      date not null,
  status_code         luna_travel.flight_status_code not null default 'Unknown',
  est_dep_time        timestamptz,
  actual_dep_time     timestamptz,
  est_arr_time        timestamptz,
  actual_arr_time     timestamptz,
  dep_terminal_live   text,
  dep_gate            text,
  arr_terminal_live   text,
  baggage_belt        text,
  check_in_desk       text,
  check_in_opens_at   timestamptz,
  boarding_at         timestamptz,
  leave_by_at         timestamptz,
  ada_subscription_id text,
  dep_airport_icao    text,
  arr_airport_icao    text,
  has_live_coverage   boolean not null default false,
  watch_state         luna_travel.flight_watch_state not null default 'pending',
  last_updated        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  constraint trip_flights_booking_ref_flight_leg_id_key unique (booking_ref, flight_leg_id)
);
create index if not exists idx_trip_flights_booking on luna_travel.trip_flights (booking_ref);
create index if not exists idx_trip_flights_sub     on luna_travel.trip_flights (ada_subscription_id);
create index if not exists idx_trip_flights_watch   on luna_travel.trip_flights (watch_state) where (watch_state = 'active');
alter table luna_travel.trip_flights enable row level security;

-- ── app_opens ────────────────────────────────────────────────────────────────
create table if not exists luna_travel.app_opens (
  id           uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references luna_travel.travellers(id) on delete cascade,
  agency_id    text not null,
  opened_at    timestamptz not null default now(),
  standalone   boolean not null default false,
  platform     text
);
create index if not exists app_opens_agency_idx     on luna_travel.app_opens (agency_id);
create index if not exists app_opens_opened_at_idx   on luna_travel.app_opens (opened_at desc);
create index if not exists app_opens_standalone_idx  on luna_travel.app_opens (traveller_id) where (standalone = true);
create index if not exists app_opens_traveller_idx   on luna_travel.app_opens (traveller_id);
alter table luna_travel.app_opens enable row level security;

-- ── audit_events ─────────────────────────────────────────────────────────────
create table if not exists luna_travel.audit_events (
  id           uuid primary key default gen_random_uuid(),
  event_type   luna_travel.audit_event_type not null,
  actor        text not null,
  target_id    text,
  target_label text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_events_actor_idx      on luna_travel.audit_events (actor);
create index if not exists audit_events_created_at_idx  on luna_travel.audit_events (created_at desc);
create index if not exists audit_events_event_type_idx  on luna_travel.audit_events (event_type);
create index if not exists audit_events_target_id_idx   on luna_travel.audit_events (target_id) where (target_id is not null);
alter table luna_travel.audit_events enable row level security;

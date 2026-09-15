-- Named party members: one traveller row per PERSON, not per booking.
--
-- Until now the unique key was (agency_id, booking_ref), so a booking had
-- exactly one traveller. Whoever redeemed first owned it; anyone else following
-- the same link was silently handed that first person's record. Every reply to
-- the agent came from one name, "revoke" was all-or-nothing, and there was no
-- way to tell who had opened what.
--
-- The key is now the PERSON within the booking: (agency_id, booking_ref,
-- pax_ref). See src/lib/party.ts for how pax_ref is derived — from the
-- passenger's name on the Travelify manifest, deliberately not from their
-- position in it (Travelify may reorder) and deliberately not from their email
-- (Travelify only matches the one address held on the order, so the whole party
-- authenticates with the same one — keying on it would collapse them back into
-- a single row, which is the bug this removes).

alter table luna_travel.travellers
  add column if not exists pax_ref text,
  add column if not exists is_lead boolean;

-- Every existing row predates the party model: it is the sole traveller on its
-- booking, so it is the lead. Its pax_ref is derived from the name it already
-- carries, by the same rule as src/lib/party.ts paxRef() — lower-case, with
-- everything that is not a letter or digit removed — so when that traveller
-- next opens the app they match their own row instead of gaining a second one.
update luna_travel.travellers
set is_lead = true,
    pax_ref = coalesce(
      nullif(regexp_replace(lower(coalesce(lead_passenger_name, '')), '[^a-z0-9]+', '', 'g'), ''),
      'traveller'
    )
where pax_ref is null or is_lead is null;

alter table luna_travel.travellers
  alter column pax_ref set not null,
  alter column is_lead set not null,
  -- New rows say so explicitly. Defaulting to true would quietly make every
  -- party member a lead the first time a caller forgot to set it.
  alter column is_lead set default false,
  -- A default on a NOT NULL column so this migration can be applied BEFORE the
  -- code that uses it. Without one, the currently deployed redeem route — which
  -- knows nothing of pax_ref — would fail every insert between the migration
  -- and the deploy, and a traveller redeeming in that window would simply be
  -- told their booking could not be found. With it, old code keeps writing one
  -- row per booking exactly as it does today; new code always sets pax_ref
  -- explicitly and never sees this value.
  alter column pax_ref set default 'traveller';

alter table luna_travel.travellers
  drop constraint if exists travellers_agency_booking_unique;

create unique index if not exists travellers_agency_booking_pax_unique
  on luna_travel.travellers (agency_id, booking_ref, pax_ref);

comment on column luna_travel.travellers.pax_ref is
  'Stable key for this person within the booking, from their name on the manifest. See src/lib/party.ts.';

comment on column luna_travel.travellers.is_lead is
  'Is this the lead passenger on the booking? Several rows now share a booking_ref.';

-- Reading "lead_passenger_name" as "this row''s traveller" is correct but the
-- name is a leftover from when a booking had exactly one of them. Renaming it
-- touches a dozen read sites and is not worth coupling to this change; it is a
-- follow-up on its own.
comment on column luna_travel.travellers.lead_passenger_name is
  'THIS row''s traveller name (not necessarily the lead — see is_lead). Legacy column name; rename pending.';

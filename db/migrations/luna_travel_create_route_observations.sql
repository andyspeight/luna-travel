-- Our own route database, accumulated rather than bought.
--
-- AeroDataBox answers one question: what flew out of this airport in the last
-- seven days. On its own that is a weak source — a twice-weekly service that
-- happened not to run, or a ski charter asked about in July, is simply absent,
-- and absent looks exactly like "no such route".
--
-- Asked every week and never thrown away, the same source becomes something
-- nobody sells us: a full year of which routes run, who flies them, and in
-- which months. It costs about fifty API calls a week and it improves on its
-- own. That is the whole idea.
--
-- THE RULE THIS SCHEMA EXISTS TO ENFORCE: a row here means "we have seen this
-- flown". There is no row anywhere that means "this route does not exist", and
-- none may ever be added. Absence of a row is ignorance, not evidence.

CREATE TABLE IF NOT EXISTS luna_travel.route_observations (
  id               bigserial PRIMARY KEY,

  origin_iata      text        NOT NULL,
  destination_iata text        NOT NULL,

  -- The operating airline. Stored by name AND codes because one brand flies
  -- under several air operator certificates: Wizz Air Hungary (W6/WZZ) and
  -- Wizz Air Malta (W4/WMT) are separate operators on the same city pair, and
  -- which one runs varies week to week. The first live probe of Cluj to Malaga
  -- returned the Malta arm, so a lookup keyed on W6 alone would have answered
  -- "no direct flight" on the exact route that started all this.
  carrier_key      text        NOT NULL,   -- lowercased name, the dedupe key
  carrier_name     text        NOT NULL,
  carrier_iata     text,
  carrier_icao     text,

  -- Which calendar months we have ever observed this flying, 1-12. This is the
  -- field that answers a July question about a February ski charter, and the
  -- single reason accumulating beats asking once.
  months_seen      smallint[]  NOT NULL DEFAULT '{}',

  first_seen_on    date        NOT NULL,
  last_seen_on     date        NOT NULL,
  observations     integer     NOT NULL DEFAULT 1,

  -- Most recent seven-day average from the provider. Diagnostic only: it is a
  -- backward-looking sample, never shown to a visitor as a frequency promise.
  avg_daily_flights real,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS route_observations_pair_carrier_idx
  ON luna_travel.route_observations (origin_iata, destination_iata, carrier_key);

-- The lookup Luna makes: "anything on this pair?"
CREATE INDEX IF NOT EXISTS route_observations_pair_idx
  ON luna_travel.route_observations (origin_iata, destination_iata);

-- Sweep coverage per departure airport.
--
-- This table is what keeps the system honest. Without it, an airport with no
-- schedules feed returns an empty list that is indistinguishable from an
-- airport with no routes, and that ambiguity is precisely how a lookup starts
-- quietly meaning "no". A pair is only ever "not confirmed"; whether we have
-- any right to an opinion at all is recorded here instead.
CREATE TABLE IF NOT EXISTS luna_travel.route_airport_status (
  iata            text        PRIMARY KEY,
  icao            text,
  covered         boolean     NOT NULL DEFAULT false,  -- schedules feed OK/OKPartial
  schedules_feed  text,
  last_status     integer,                             -- HTTP status of the last routes call
  route_count     integer     NOT NULL DEFAULT 0,      -- destinations seen in the last sweep
  sweeps          integer     NOT NULL DEFAULT 0,
  last_swept_at   timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS route_observations_set_updated_at ON luna_travel.route_observations;
CREATE TRIGGER route_observations_set_updated_at
  BEFORE UPDATE ON luna_travel.route_observations
  FOR EACH ROW EXECUTE FUNCTION luna_travel.set_updated_at();

DROP TRIGGER IF EXISTS route_airport_status_set_updated_at ON luna_travel.route_airport_status;
CREATE TRIGGER route_airport_status_set_updated_at
  BEFORE UPDATE ON luna_travel.route_airport_status
  FOR EACH ROW EXECUTE FUNCTION luna_travel.set_updated_at();

-- RLS enabled with NO policies, matching every other table in this schema
-- (see luna_travel_baseline.sql). Both tables are written by the weekly cron
-- and read by the internal lookup route, and both go through the service-role
-- key, which bypasses RLS. Nothing here is ever reached by an anon or
-- authenticated client, so no policy is needed and leaving RLS off would only
-- raise a Supabase advisory.
ALTER TABLE luna_travel.route_observations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE luna_travel.route_airport_status ENABLE ROW LEVEL SECURITY;

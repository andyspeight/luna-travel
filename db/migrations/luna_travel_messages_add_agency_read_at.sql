-- Track when the agency has read a traveller's reply. Only meaningful for
-- direction = 'traveller_to_agency' (traveller→agency messages carry no
-- recipient row, so read state for the agency lives here). NULL = unread by
-- the agency. Used for unread badges + counts in the portal.
ALTER TABLE luna_travel.messages
  ADD COLUMN IF NOT EXISTS agency_read_at timestamptz;

-- Partial index to make "unread replies for this agency" cheap.
CREATE INDEX IF NOT EXISTS messages_agency_unread_idx
  ON luna_travel.messages (agency_id)
  WHERE direction = 'traveller_to_agency' AND agency_read_at IS NULL;

-- luna_travel.agency_login_tokens — magic-link login for Luna-native agencies.
-- Applied to the production Supabase (Travelgenix CRM project) on 2026-07-10.
--
-- Luna-native agencies (id `lt…`) are non-Travelgenix clients, so they have no
-- Travelgenix ID / SSO login. This table backs a passwordless magic-link flow
-- so such an agency can sign in to its own portal (branding + send-access) with
-- no SSO: an operator (or, later, a "email me a link" self-serve request)
-- mints a single-use token; clicking the link exchanges it for an
-- `lt_agency_session` cookie scoped to that one agency.
--
--   token_hash — sha256 hex of the raw token; the raw token is never stored.
--   used_at    — set atomically on first consume, so a link works exactly once.
--   expires_at — hard expiry independent of used_at.
--
-- Service-role access only (RLS enabled, no policies).

create table if not exists luna_travel.agency_login_tokens (
  id          uuid primary key default gen_random_uuid(),
  agency_id   text not null,
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists agency_login_tokens_agency_idx
  on luna_travel.agency_login_tokens (agency_id);
create index if not exists agency_login_tokens_active_idx
  on luna_travel.agency_login_tokens (token_hash) where used_at is null;
alter table luna_travel.agency_login_tokens enable row level security;

comment on table luna_travel.agency_login_tokens is
  'Single-use magic-link tokens for Luna-native agency portal login (no Travelgenix SSO). token_hash = sha256 of the raw token. Service-role access only (RLS on, no policies).';

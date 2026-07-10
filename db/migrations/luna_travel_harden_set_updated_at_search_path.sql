-- Pin the search_path on luna_travel.set_updated_at() to clear the Supabase
-- "function_search_path_mutable" advisory. Applied to prod on 2026-07-10.
-- The function only sets NEW.updated_at = now() (now() lives in pg_catalog,
-- which is always in scope), so an empty search_path is safe.

alter function luna_travel.set_updated_at() set search_path = '';

-- One-shot listing of every object in the destination-heroes bucket, so the
-- admin Hero images page loads in ONE query instead of one storage list call
-- per country folder (~250 sequential calls — the page took minutes).
-- security definer because storage.objects is outside the luna_travel
-- PostgREST schema; execution is restricted to service_role.
create or replace function luna_travel.list_hero_objects()
returns table(name text, updated_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select o.name, o.updated_at
  from storage.objects o
  where o.bucket_id = 'destination-heroes'
$$;

revoke all on function luna_travel.list_hero_objects() from public;
revoke all on function luna_travel.list_hero_objects() from anon;
revoke all on function luna_travel.list_hero_objects() from authenticated;
grant execute on function luna_travel.list_hero_objects() to service_role;

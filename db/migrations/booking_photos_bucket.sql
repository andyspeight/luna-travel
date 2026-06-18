-- Public storage bucket for off-platform booking product photos (hotels,
-- excursions, transfers, etc.). Created on the production Supabase 2026-06-17.
-- Public so the PWA renders images via durable URLs (like destination-heroes);
-- uploads are service-role only, via /api/admin/agencies/[id]/booking-photo.

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', true)
on conflict (id) do update set public = true;

-- Public bucket for vendor portfolio / uploads (paths like users/{id}/images/...).
-- Apply in Supabase SQL editor. Match MEDIA_IMAGES_BUCKET in backend/.env (default: eventtz-images).
-- If this fails, create the bucket in Dashboard → Storage instead.

insert into storage.buckets (id, name, public)
values ('eventtz-images', 'eventtz-images', true)
on conflict (id) do update set public = excluded.public;

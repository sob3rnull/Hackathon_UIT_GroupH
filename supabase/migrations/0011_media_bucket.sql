-- Public "media" bucket for site photos (hero background, logo, impact
-- gallery) and the RLS letting admins manage it from the browser. Run after
-- 0009. Reuses jwt_role() from 0007 — no new helper needed.
--
-- Storage RLS note: marking the bucket public only affects the unauthenticated
-- *download* path (/storage/v1/object/public/...), which bypasses RLS
-- entirely. list/upload/update/remove all go through storage.objects RLS
-- below regardless of the public flag.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Anyone (including anon) can list and download — the public page's gallery
-- and the header logo render for signed-out visitors.
drop policy if exists "media publicly readable" on storage.objects;
create policy "media publicly readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- Only admins can add, replace or remove media. Uploads happen straight from
-- the browser (src/components/admin/media-manager.tsx) using the signed-in
-- user's own session — this policy is the entire authorization boundary,
-- there's no server route bypassing it with a service-role key.
drop policy if exists "admin manages media" on storage.objects;
create policy "admin manages media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select public.jwt_role()) = 'admin');

drop policy if exists "admin updates media" on storage.objects;
create policy "admin updates media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.jwt_role()) = 'admin')
  with check (bucket_id = 'media' and (select public.jwt_role()) = 'admin');

drop policy if exists "admin deletes media" on storage.objects;
create policy "admin deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select public.jwt_role()) = 'admin');

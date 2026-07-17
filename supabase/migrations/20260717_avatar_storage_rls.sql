-- Storage RLS for the avatars bucket.
--
-- The profiles table UPDATE policy was landed yesterday, so the second-stage
-- "write the public URL back to profiles.avatar_url" now works. But avatar
-- upload actually happens in two stages:
--
--   1. supabase.storage.from('avatars').upload(path, blob)
--        → gated by RLS on storage.objects
--   2. supabase.from('profiles').update({ avatar_url })
--        → gated by RLS on public.profiles
--
-- The "permission denied" error is fired at stage 1 when the storage.objects
-- policies don't scope INSERT/UPDATE to the caller's own folder. This
-- migration:
--
--   • ensures the avatars bucket exists and is PUBLIC (any anon browser can
--     read the file, which is what shows the picture on listings pages)
--   • drops any lingering policies with the same names so the file can be
--     re-run safely
--   • adds SELECT (public), INSERT/UPDATE/DELETE (scoped to auth.uid())

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

-- Public read — the URL lives on <img> tags in browse/dashboard for
-- unauthenticated visitors.
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Uploads must land inside {auth.uid()}/, matching the path AvatarUpload
-- writes (`${userId}/avatar.jpg`). storage.foldername returns the parts of
-- the path before the filename — index [1] is the top-level folder.
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upsert: true on the SDK actually issues an UPDATE when the object already
-- exists — so an INSERT policy alone isn't enough; the second upload of a
-- new avatar would fail without this.
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE for hygiene (e.g. account deletion, admin cleanup).
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

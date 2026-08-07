begin;

alter table if exists public.households
add column if not exists avatar_url text;

-- Legacy-compatible entry point. Keep the same restrictions as
-- supabase_rls_foundation.sql so running this older script cannot weaken the
-- production bucket.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_select" on storage.objects;
drop policy if exists "profile_photos_insert_own" on storage.objects;
drop policy if exists "profile_photos_update_own" on storage.objects;
drop policy if exists "profile_photos_delete_own" on storage.objects;

create policy "profile_photos_select"
on storage.objects for select to public
using (bucket_id = 'profile-photos');

create policy "profile_photos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and storage.filename(name) = 'avatar'
  and exists (
    select 1
    from public.household_members as member
    where member.profile_id = auth.uid()
      and name = member.household_id::text || '/avatar'
  )
);

create policy "profile_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and storage.filename(name) = 'avatar'
  and exists (
    select 1
    from public.household_members as member
    where member.profile_id = auth.uid()
      and name = member.household_id::text || '/avatar'
  )
)
with check (
  bucket_id = 'profile-photos'
  and storage.filename(name) = 'avatar'
  and exists (
    select 1
    from public.household_members as member
    where member.profile_id = auth.uid()
      and name = member.household_id::text || '/avatar'
  )
);

create policy "profile_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1
    from public.household_members as member
    where member.profile_id = auth.uid()
      and (storage.foldername(name))[1] = member.household_id::text
  )
);

commit;

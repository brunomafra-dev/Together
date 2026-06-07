begin;

alter table if exists public.households
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update set public = true;

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
  and exists (
    select 1
    from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
      and hm.profile_id = auth.uid()
  )
);

create policy "profile_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
      and hm.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'profile-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
      and hm.profile_id = auth.uid()
  )
);

create policy "profile_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
      and hm.profile_id = auth.uid()
  )
);

commit;

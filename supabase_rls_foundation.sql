begin;

-- Apply this migration after supabase_setup.sql and before every migration
-- whose policies call is_household_member(). It also replaces the recursive
-- household_members policies installed by older setup scripts.
do $$
declare
  missing_columns text;
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.households') is null
    or to_regclass('public.household_members') is null then
    raise exception 'Missing household prerequisites for the RLS foundation'
      using hint = 'Create profiles, households and household_members, then apply supabase_setup.sql first.';
  end if;

  select string_agg(
    expected.table_name || '.' || expected.column_name,
    ', ' order by expected.table_name, expected.column_name
  )
  into missing_columns
  from (
    values
      ('profiles', 'id'),
      ('profiles', 'name'),
      ('profiles', 'email'),
      ('households', 'id'),
      ('households', 'name'),
      ('households', 'monthly_income'),
      ('households', 'partner_1_name'),
      ('households', 'partner_2_name'),
      ('household_members', 'household_id'),
      ('household_members', 'profile_id')
  ) as expected(table_name, column_name)
  left join information_schema.columns as actual
    on actual.table_schema = 'public'
    and actual.table_name = expected.table_name
    and actual.column_name = expected.column_name
  where actual.column_name is null;

  if missing_columns is not null then
    raise exception 'Household base schema is incompatible with the current client'
      using detail = missing_columns,
            hint = 'Apply the missing base columns explicitly, then rerun this migration.';
  end if;
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is null
    or to_regclass('storage.objects') is null then
    raise exception 'Supabase Storage prerequisites are missing'
      using hint = 'Enable Supabase Storage and apply supabase_setup.sql before this foundation migration.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
  )
  or not exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    raise exception 'The profile-photos bucket cannot be hardened on this Storage schema'
      using hint = 'Update Supabase Storage so buckets has file_size_limit and allowed_mime_types.';
  end if;
end;
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and target_household_id is not null
    and exists (
      select 1
      from public.household_members as member
      where member.household_id = target_household_id
        and member.profile_id = auth.uid()
    );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create index if not exists household_members_profile_household_idx
on public.household_members (profile_id, household_id);

alter table public.household_members enable row level security;

drop policy if exists "select own household members" on public.household_members;
drop policy if exists "write own household members" on public.household_members;
drop policy if exists "household_members_select_v2" on public.household_members;
drop policy if exists "household_members_insert_v2" on public.household_members;
drop policy if exists "household_members_update_v2" on public.household_members;
drop policy if exists "household_members_delete_v2" on public.household_members;

create policy "household_members_select_v2"
on public.household_members for select to authenticated
using (public.is_household_member(household_id));

-- Membership writes are RPC-only. A future invitation flow must use a
-- SECURITY DEFINER RPC that validates the invite instead of accepting profile
-- UUIDs directly from authenticated clients.

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

-- Public reads are retained for existing avatar URLs. New writes are limited
-- to one fixed object per household, so upsert replaces instead of accumulating
-- files. Existing objects are intentionally left untouched.
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

-- Members may still remove older objects below their own household folder.
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

-- The current client calls this RPC without arguments and expects a UUID.
-- Remove the obsolete overload that accepted p_household_name so PostgREST
-- has one unambiguous zero-argument contract.
drop function if exists public.bootstrap_current_user_household(text);

create or replace function public.bootstrap_current_user_household()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  current_user_metadata jsonb;
  display_name text;
  household_id_result uuid;
begin
  if current_user_id is null then
    raise exception 'User must be authenticated to initialize a household'
      using errcode = '42501';
  end if;

  current_user_email := coalesce(nullif(btrim(auth.jwt() ->> 'email'), ''), '');
  current_user_metadata := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  display_name := coalesce(
    nullif(btrim(current_user_metadata ->> 'name'), ''),
    nullif(btrim(current_user_metadata ->> 'full_name'), ''),
    nullif(current_user_email, ''),
    'Household'
  );

  -- Two tabs completing the first login must not create two households.
  perform pg_advisory_xact_lock(
    hashtextextended('bootstrap-household:' || current_user_id::text, 0)
  );

  select member.household_id
  into household_id_result
  from public.household_members as member
  where member.profile_id = current_user_id
    and member.household_id is not null
  order by member.household_id
  limit 1
  for share;

  if household_id_result is not null then
    return household_id_result;
  end if;

  insert into public.profiles as profile (id, name, email)
  values (current_user_id, display_name, current_user_email)
  on conflict (id) do update
  set name = coalesce(nullif(profile.name, ''), excluded.name),
      email = coalesce(nullif(profile.email, ''), excluded.email);

  insert into public.households (
    name,
    monthly_income,
    partner_1_name,
    partner_2_name
  ) values (
    display_name,
    0,
    display_name,
    null
  )
  returning id into household_id_result;

  insert into public.household_members (household_id, profile_id)
  values (household_id_result, current_user_id);

  return household_id_result;
end;
$$;

revoke all on function public.bootstrap_current_user_household() from public;
grant execute on function public.bootstrap_current_user_household() to authenticated;

comment on function public.bootstrap_current_user_household() is
'Returns the current user household or atomically creates the first profile, household and membership.';

-- Household creation is RPC-only. The SECURITY DEFINER function above performs
-- authentication, serialization and first-member creation in one transaction.
drop policy if exists "insert household" on public.households;

commit;

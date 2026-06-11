create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  amount numeric not null default 0,
  entry_date date not null default current_date,
  description text,
  source_type text not null default 'extra',
  received_by text,
  recurring_monthly boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.income_entries enable row level security;

drop policy if exists "income_entries_select_household_members" on public.income_entries;
drop policy if exists "income_entries_insert_household_members" on public.income_entries;
drop policy if exists "income_entries_update_household_members" on public.income_entries;
drop policy if exists "income_entries_delete_household_members" on public.income_entries;

create policy "income_entries_select_household_members"
on public.income_entries
for select
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = income_entries.household_id
      and hm.profile_id = auth.uid()
  )
);

create policy "income_entries_insert_household_members"
on public.income_entries
for insert
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = income_entries.household_id
      and hm.profile_id = auth.uid()
  )
);

create policy "income_entries_update_household_members"
on public.income_entries
for update
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = income_entries.household_id
      and hm.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = income_entries.household_id
      and hm.profile_id = auth.uid()
  )
);

create policy "income_entries_delete_household_members"
on public.income_entries
for delete
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = income_entries.household_id
      and hm.profile_id = auth.uid()
  )
);

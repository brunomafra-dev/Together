create table if not exists public.fixed_expense_monthly_values (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  fixed_expense_id uuid references public.fixed_expenses(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2000),
  estimated_amount numeric not null default 0,
  actual_amount numeric,
  status text not null default 'estimated' check (status in ('estimated', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixed_expense_id, month, year)
);

alter table public.fixed_expense_monthly_values enable row level security;

drop policy if exists "fixed_expense_monthly_values_select_household_members" on public.fixed_expense_monthly_values;
drop policy if exists "fixed_expense_monthly_values_insert_household_members" on public.fixed_expense_monthly_values;
drop policy if exists "fixed_expense_monthly_values_update_household_members" on public.fixed_expense_monthly_values;

create policy "fixed_expense_monthly_values_select_household_members"
on public.fixed_expense_monthly_values
for select
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = fixed_expense_monthly_values.household_id
      and hm.profile_id = auth.uid()
  )
);

create policy "fixed_expense_monthly_values_insert_household_members"
on public.fixed_expense_monthly_values
for insert
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = fixed_expense_monthly_values.household_id
      and hm.profile_id = auth.uid()
  )
);

create policy "fixed_expense_monthly_values_update_household_members"
on public.fixed_expense_monthly_values
for update
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = fixed_expense_monthly_values.household_id
      and hm.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = fixed_expense_monthly_values.household_id
      and hm.profile_id = auth.uid()
  )
);

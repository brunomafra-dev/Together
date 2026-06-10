create table if not exists public.household_finance_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  active_month integer not null check (active_month between 1 and 12),
  active_year integer not null check (active_year between 2000 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_finance_state enable row level security;

drop policy if exists "household_finance_state_select_member" on public.household_finance_state;
drop policy if exists "household_finance_state_write_member" on public.household_finance_state;

create policy "household_finance_state_select_member"
on public.household_finance_state for select to authenticated
using (public.is_household_member(household_id));

create policy "household_finance_state_write_member"
on public.household_finance_state for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

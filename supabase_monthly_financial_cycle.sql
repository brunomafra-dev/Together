begin;

alter table if exists public.cards
add column if not exists closing_day integer;

alter table if exists public.cards
add column if not exists due_day integer;

alter table if exists public.cards
drop constraint if exists cards_closing_day_check;

alter table if exists public.cards
add constraint cards_closing_day_check
check (closing_day is null or (closing_day between 1 and 31));

alter table if exists public.cards
drop constraint if exists cards_due_day_check;

alter table if exists public.cards
add constraint cards_due_day_check
check (due_day is null or (due_day between 1 and 31));

create table if not exists public.monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  monthly_income numeric not null default 0,
  total_expenses numeric not null default 0,
  fixed_expenses_total numeric not null default 0,
  installment_expenses_total numeric not null default 0,
  remaining_balance numeric not null default 0,
  category_totals jsonb not null default '[]'::jsonb,
  card_totals jsonb not null default '[]'::jsonb,
  goal_progress jsonb not null default '[]'::jsonb,
  financial_health jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (household_id, month, year)
);

create index if not exists monthly_snapshots_household_month_idx
on public.monthly_snapshots (household_id, year, month);

alter table public.monthly_snapshots enable row level security;

drop policy if exists "monthly_snapshots_select_member" on public.monthly_snapshots;
drop policy if exists "monthly_snapshots_insert_member" on public.monthly_snapshots;
drop policy if exists "monthly_snapshots_delete_member" on public.monthly_snapshots;

create policy "monthly_snapshots_select_member"
on public.monthly_snapshots for select to authenticated
using (public.is_household_member(household_id));

create policy "monthly_snapshots_insert_member"
on public.monthly_snapshots for insert to authenticated
with check (public.is_household_member(household_id));

create policy "monthly_snapshots_delete_member"
on public.monthly_snapshots for delete to authenticated
using (public.is_household_member(household_id));

commit;

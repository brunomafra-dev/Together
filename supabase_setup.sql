-- Create extension for UUID generation
create extension if not exists "pgcrypto";

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
    select 1 from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
    and hm.profile_id = auth.uid()
  )
);

create policy "profile_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
    and hm.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
    and hm.profile_id = auth.uid()
  )
);

create policy "profile_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.household_members hm
    where hm.household_id = ((storage.foldername(name))[1])::uuid
    and hm.profile_id = auth.uid()
  )
);

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_current_user() to authenticated;

-- ============================================================
-- STEP 1: Fix existing tables (add missing household_id if needed)
-- ============================================================

-- Check and alter cards table if household_id is missing
alter table if exists public.cards 
add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table if exists public.cards
add column if not exists type text not null default 'credit_card';

alter table if exists public.cards
add column if not exists closing_day integer;

alter table if exists public.cards
add column if not exists due_day integer;

alter table if exists public.cards
drop constraint if exists cards_type_check;

alter table if exists public.cards
add constraint cards_type_check
check (type in ('credit_card', 'debit', 'pix', 'cash'));

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

-- Check and alter categories table if household_id is missing
alter table if exists public.categories 
add column if not exists household_id uuid references public.households(id) on delete cascade;

-- Check and alter expenses table if household_id is missing
alter table if exists public.expenses
add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table if exists public.expenses
add column if not exists paid_by text;

alter table if exists public.expenses
add column if not exists notes text;

-- ============================================================
-- STEP 2: Create fixed_expenses table if it doesn't exist
-- ============================================================
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0,
  category text not null default '',
  due_day int not null default 1 check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

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

-- ============================================================
-- STEP 3: Enable Row Level Security (RLS) on all tables
-- ============================================================

-- Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "select own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "insert own profile"
on public.profiles
for insert
with check (id = auth.uid());

create policy "update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- Households RLS
alter table public.households enable row level security;

drop policy if exists "select own household" on public.households;
drop policy if exists "insert household" on public.households;
drop policy if exists "update own household" on public.households;

create policy "select own household"
on public.households
for select
using (
  id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "insert household"
on public.households
for insert
with check (true);

create policy "update own household"
on public.households
for update
using (
  id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Household Members RLS
alter table public.household_members enable row level security;

drop policy if exists "select own household members" on public.household_members;
drop policy if exists "write own household members" on public.household_members;

create policy "select own household members"
on public.household_members
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "write own household members"
on public.household_members
for all
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Cards RLS
alter table public.cards enable row level security;

drop policy if exists "select own cards" on public.cards;
drop policy if exists "write own cards" on public.cards;

create policy "select own cards"
on public.cards
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "write own cards"
on public.cards
for all
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Categories RLS
alter table public.categories enable row level security;

drop policy if exists "select own categories" on public.categories;
drop policy if exists "write own categories" on public.categories;

create policy "select own categories"
on public.categories
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "write own categories"
on public.categories
for all
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Fixed Expenses RLS
alter table public.fixed_expenses enable row level security;

drop policy if exists "select own fixed expenses" on public.fixed_expenses;
drop policy if exists "write own fixed expenses" on public.fixed_expenses;

create policy "select own fixed expenses"
on public.fixed_expenses
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "write own fixed expenses"
on public.fixed_expenses
for all
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

alter table public.monthly_snapshots enable row level security;

drop policy if exists "select own monthly snapshots" on public.monthly_snapshots;
drop policy if exists "insert own monthly snapshots" on public.monthly_snapshots;
drop policy if exists "delete own monthly snapshots" on public.monthly_snapshots;

create policy "select own monthly snapshots"
on public.monthly_snapshots
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "insert own monthly snapshots"
on public.monthly_snapshots
for insert
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "delete own monthly snapshots"
on public.monthly_snapshots
for delete
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Expenses RLS
alter table public.expenses enable row level security;

drop policy if exists "select own expenses" on public.expenses;
drop policy if exists "write own expenses" on public.expenses;

create policy "select own expenses"
on public.expenses
for select
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

create policy "write own expenses"
on public.expenses
for all
using (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.household_members
    where profile_id = auth.uid()
  )
);

-- Installments RLS
alter table public.installments enable row level security;

drop policy if exists "select own installments" on public.installments;
drop policy if exists "write own installments" on public.installments;

create policy "select own installments"
on public.installments
for select
using (
  expense_id in (
    select id
    from public.expenses
    where household_id in (
      select household_id
      from public.household_members
      where profile_id = auth.uid()
    )
  )
);

create policy "write own installments"
on public.installments
for all
using (
  expense_id in (
    select id
    from public.expenses
    where household_id in (
      select household_id
      from public.household_members
      where profile_id = auth.uid()
    )
  )
)
with check (
  expense_id in (
    select id
    from public.expenses
    where household_id in (
      select household_id
      from public.household_members
      where profile_id = auth.uid()
    )
  )
);

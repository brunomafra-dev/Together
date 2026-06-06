-- Create extension for UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- STEP 1: Fix existing tables (add missing household_id if needed)
-- ============================================================

-- Check and alter cards table if household_id is missing
alter table if exists public.cards 
add column if not exists household_id uuid references public.households(id) on delete cascade;

-- Check and alter categories table if household_id is missing
alter table if exists public.categories 
add column if not exists household_id uuid references public.households(id) on delete cascade;

-- Check and alter expenses table if household_id is missing
alter table if exists public.expenses 
add column if not exists household_id uuid references public.households(id) on delete cascade;

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

-- ============================================================
-- STEP 3: Enable Row Level Security (RLS) on all tables
-- ============================================================

-- ============================================================
-- STEP 2.5: Bootstrap household for first login
-- ============================================================

create or replace function public.bootstrap_current_user_household(p_household_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := coalesce(auth.jwt() ->> 'email', '');
  v_household_id uuid;
  v_household_name text := coalesce(nullif(trim(p_household_name), ''), nullif(trim(coalesce(auth.jwt() ->> 'name', '')), ''), nullif(trim(v_user_email), ''), 'Household');
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select hm.household_id
    into v_household_id
  from public.household_members hm
  where hm.profile_id = v_user_id
  limit 1;

  if v_household_id is not null then
    return v_household_id;
  end if;

  insert into public.profiles (id, name, email, created_at)
  values (v_user_id, v_household_name, v_user_email, now())
  on conflict (id) do update
    set name = coalesce(nullif(excluded.name, ''), public.profiles.name),
        email = coalesce(nullif(excluded.email, ''), public.profiles.email);

  insert into public.households (name, limit_amount)
  values (v_household_name, 0)
  returning id into v_household_id;

  insert into public.household_members (household_id, profile_id)
  values (v_household_id, v_user_id);

  return v_household_id;
end;
$$;

grant execute on function public.bootstrap_current_user_household(text) to authenticated;

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

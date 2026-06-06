begin;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  label text not null default 'Objetivo',
  current_amount numeric not null default 0,
  target_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_plan_items (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  name text not null,
  share text not null,
  amount numeric not null default 0,
  tone text not null default 'stone',
  created_at timestamptz not null default now()
);

create table if not exists public.goal_progress_rows (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  name text not null,
  planned numeric not null default 0,
  realized numeric not null default 0,
  status text not null default 'Abaixo do esperado',
  created_at timestamptz not null default now()
);

create table if not exists public.financial_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  payment_method_id uuid references public.cards(id) on delete set null,
  item_name text not null,
  installment_value numeric not null default 0,
  current_installment integer not null default 1,
  total_installments integer not null default 1,
  responsible_person text not null default '',
  notes text not null default '',
  started_at date not null default current_date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_household_id_idx on public.goals (household_id);
create index if not exists goal_plan_items_goal_id_idx on public.goal_plan_items (goal_id);
create index if not exists goal_progress_rows_goal_id_idx on public.goal_progress_rows (goal_id);
create index if not exists financial_commitments_household_id_idx on public.financial_commitments (household_id);
create index if not exists financial_commitments_payment_method_id_idx on public.financial_commitments (payment_method_id);

alter table public.goals enable row level security;
alter table public.goal_plan_items enable row level security;
alter table public.goal_progress_rows enable row level security;
alter table public.financial_commitments enable row level security;

drop policy if exists "goals_select_member" on public.goals;
drop policy if exists "goals_insert_member" on public.goals;
drop policy if exists "goals_update_member" on public.goals;
drop policy if exists "goals_delete_member" on public.goals;
drop policy if exists "goal_plan_items_select_member" on public.goal_plan_items;
drop policy if exists "goal_plan_items_insert_member" on public.goal_plan_items;
drop policy if exists "goal_plan_items_update_member" on public.goal_plan_items;
drop policy if exists "goal_plan_items_delete_member" on public.goal_plan_items;
drop policy if exists "goal_progress_rows_select_member" on public.goal_progress_rows;
drop policy if exists "goal_progress_rows_insert_member" on public.goal_progress_rows;
drop policy if exists "goal_progress_rows_update_member" on public.goal_progress_rows;
drop policy if exists "goal_progress_rows_delete_member" on public.goal_progress_rows;
drop policy if exists "financial_commitments_select_member" on public.financial_commitments;
drop policy if exists "financial_commitments_insert_member" on public.financial_commitments;
drop policy if exists "financial_commitments_update_member" on public.financial_commitments;
drop policy if exists "financial_commitments_delete_member" on public.financial_commitments;

create policy "goals_select_member"
on public.goals for select to authenticated
using (public.is_household_member(household_id));
create policy "goals_insert_member"
on public.goals for insert to authenticated
with check (public.is_household_member(household_id));
create policy "goals_update_member"
on public.goals for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "goals_delete_member"
on public.goals for delete to authenticated
using (public.is_household_member(household_id));

create policy "goal_plan_items_select_member"
on public.goal_plan_items for select to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_plan_items_insert_member"
on public.goal_plan_items for insert to authenticated
with check (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_plan_items_update_member"
on public.goal_plan_items for update to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)))
with check (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_plan_items_delete_member"
on public.goal_plan_items for delete to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));

create policy "goal_progress_rows_select_member"
on public.goal_progress_rows for select to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_progress_rows_insert_member"
on public.goal_progress_rows for insert to authenticated
with check (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_progress_rows_update_member"
on public.goal_progress_rows for update to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)))
with check (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));
create policy "goal_progress_rows_delete_member"
on public.goal_progress_rows for delete to authenticated
using (exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id)));

create policy "financial_commitments_select_member"
on public.financial_commitments for select to authenticated
using (public.is_household_member(household_id));
create policy "financial_commitments_insert_member"
on public.financial_commitments for insert to authenticated
with check (public.is_household_member(household_id));
create policy "financial_commitments_update_member"
on public.financial_commitments for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "financial_commitments_delete_member"
on public.financial_commitments for delete to authenticated
using (public.is_household_member(household_id));

commit;

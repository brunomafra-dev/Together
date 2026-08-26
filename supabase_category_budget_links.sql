begin;

do $$
begin
  if to_regclass('public.categories') is null
    or to_regclass('public.fixed_expenses') is null
    or to_regclass('public.goals') is null
    or to_regclass('public.goal_plan_items') is null then
    raise exception 'Missing prerequisites for category budget links'
      using hint = 'Apply the base, fixed expense and goals migrations first.';
  end if;
end;
$$;

alter table public.categories
  add column if not exists goal_plan_item_id uuid;

alter table public.fixed_expenses
  add column if not exists category_id uuid;

-- Preserve existing fixed-expense classifications by matching their legacy
-- text category to a category from the same household.
update public.fixed_expenses as fixed
set category_id = (
  select category.id
  from public.categories as category
  where category.household_id = fixed.household_id
    and lower(btrim(category.name)) = lower(btrim(fixed.category))
  order by category.id
  limit 1
)
where fixed.category_id is null
  and nullif(btrim(fixed.category), '') is not null;

-- Existing plans used equal names as an implicit link. Convert those matches
-- once so future renames remain stable because the relationship uses UUIDs.
update public.categories as category
set goal_plan_item_id = (
  select plan_item.id
  from public.goal_plan_items as plan_item
  join public.goals as goal on goal.id = plan_item.goal_id
  where goal.household_id = category.household_id
    and lower(btrim(plan_item.name)) = lower(btrim(category.name))
  order by goal.updated_at desc, plan_item.created_at, plan_item.id
  limit 1
)
where category.goal_plan_item_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'categories_goal_plan_item_fkey'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_goal_plan_item_fkey
      foreign key (goal_plan_item_id)
      references public.goal_plan_items(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fixed_expenses_category_fkey'
      and conrelid = 'public.fixed_expenses'::regclass
  ) then
    alter table public.fixed_expenses
      add constraint fixed_expenses_category_fkey
      foreign key (category_id)
      references public.categories(id)
      on delete set null
      not valid;
  end if;
end;
$$;

alter table public.categories
  validate constraint categories_goal_plan_item_fkey;

alter table public.fixed_expenses
  validate constraint fixed_expenses_category_fkey;

create index if not exists categories_goal_plan_item_id_idx
  on public.categories (goal_plan_item_id);

create index if not exists fixed_expenses_category_id_idx
  on public.fixed_expenses (category_id);

create or replace function public.validate_category_budget_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.goal_plan_item_id is not null
    and not exists (
      select 1
      from public.goal_plan_items as plan_item
      join public.goals as goal on goal.id = plan_item.goal_id
      where plan_item.id = new.goal_plan_item_id
        and goal.household_id = new.household_id
    ) then
    raise exception 'Category and budget division must belong to the same household'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_fixed_expense_category()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.category_id is not null
    and not exists (
      select 1
      from public.categories as category
      where category.id = new.category_id
        and category.household_id = new.household_id
    ) then
    raise exception 'Fixed expense and category must belong to the same household'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.sync_fixed_expense_category_name()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.name is distinct from old.name then
    update public.fixed_expenses
    set category = new.name
    where category_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_category_budget_link() from public;
revoke all on function public.validate_fixed_expense_category() from public;
revoke all on function public.sync_fixed_expense_category_name() from public;

drop trigger if exists categories_validate_budget_link on public.categories;
create trigger categories_validate_budget_link
before insert or update of household_id, goal_plan_item_id
on public.categories
for each row execute function public.validate_category_budget_link();

drop trigger if exists fixed_expenses_validate_category on public.fixed_expenses;
create trigger fixed_expenses_validate_category
before insert or update of household_id, category_id
on public.fixed_expenses
for each row execute function public.validate_fixed_expense_category();

drop trigger if exists categories_sync_fixed_expense_name on public.categories;
create trigger categories_sync_fixed_expense_name
after update of name
on public.categories
for each row execute function public.sync_fixed_expense_category_name();

commit;

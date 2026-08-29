begin;

-- Apply after supabase_manual_financial_cycles_and_invoices.sql. This patch
-- deliberately leaves the public close_financial_cycle function untouched.
do $$
declare
  missing_columns text;
begin
  if to_regclass('public.cards') is null
    or to_regclass('public.expenses') is null
    or to_regclass('public.categories') is null
    or to_regclass('public.household_members') is null
    or to_regclass('public.income_entries') is null
    or to_regclass('public.fixed_expenses') is null
    or to_regclass('public.fixed_expense_monthly_values') is null
    or to_regclass('public.financial_commitments') is null
    or to_regclass('public.monthly_snapshots') is null then
    raise exception 'Missing finance prerequisites for the integrity v2 migration'
      using hint = 'Apply the documented migrations through supabase_manual_financial_cycles_and_invoices.sql first.';
  end if;

  select string_agg(
    expected.table_name || '.' || expected.column_name,
    ', ' order by expected.table_name, expected.column_name
  )
  into missing_columns
  from (
    values
      ('cards', 'id'),
      ('cards', 'household_id'),
      ('cards', 'type'),
      ('cards', 'closing_day'),
      ('cards', 'due_day'),
      ('categories', 'id'),
      ('categories', 'household_id'),
      ('expenses', 'id'),
      ('expenses', 'household_id'),
      ('expenses', 'card_id'),
      ('expenses', 'category_id'),
      ('expenses', 'purchase_date'),
      ('expenses', 'created_at'),
      ('expenses', 'invoice_closing_date'),
      ('expenses', 'invoice_due_date'),
      ('household_members', 'household_id'),
      ('household_members', 'profile_id'),
      ('income_entries', 'id'),
      ('income_entries', 'household_id'),
      ('income_entries', 'entry_date'),
      ('fixed_expenses', 'id'),
      ('fixed_expenses', 'household_id'),
      ('fixed_expense_monthly_values', 'household_id'),
      ('fixed_expense_monthly_values', 'fixed_expense_id'),
      ('fixed_expense_monthly_values', 'month'),
      ('fixed_expense_monthly_values', 'year'),
      ('financial_commitments', 'id'),
      ('financial_commitments', 'household_id'),
      ('financial_commitments', 'payment_method_id'),
      ('financial_commitments', 'category_id'),
      ('financial_commitments', 'installment_value'),
      ('financial_commitments', 'current_installment'),
      ('financial_commitments', 'total_installments'),
      ('financial_commitments', 'status'),
      ('financial_commitments', 'created_at'),
      ('financial_commitments', 'updated_at')
  ) as expected(table_name, column_name)
  left join information_schema.columns as actual
    on actual.table_schema = 'public'
    and actual.table_name = expected.table_name
    and actual.column_name = expected.column_name
  where actual.column_name is null;

  if missing_columns is not null then
    raise exception 'Finance schema is missing columns required by integrity v2'
      using detail = missing_columns,
            hint = 'Apply the documented migrations in order, then rerun this migration.';
  end if;

end;
$$;

-- Freeze the scoped parent/child sets while checking them and installing the
-- composite constraints. This closes the gap between diagnosis and VALIDATE.
lock table
  public.cards,
  public.categories,
  public.expenses,
  public.financial_commitments,
  public.fixed_expense_monthly_values,
  public.fixed_expenses
in share row exclusive mode;

-- Do not guess how to repair tenant identifiers. If legacy or orphaned links
-- exist, stop before changing any data and report every affected relation.
do $$
declare
  invalid_expense_cards bigint;
  invalid_expense_categories bigint;
  invalid_commitment_cards bigint;
  invalid_commitment_categories bigint;
  invalid_fixed_monthly_values bigint;
begin
  select count(*)
  into invalid_expense_cards
  from public.expenses as expense
  left join public.cards as card on card.id = expense.card_id
  where expense.card_id is not null
    and (
      expense.household_id is null
      or card.household_id is null
      or expense.household_id is distinct from card.household_id
    );

  select count(*)
  into invalid_expense_categories
  from public.expenses as expense
  left join public.categories as category on category.id = expense.category_id
  where expense.category_id is not null
    and (
      expense.household_id is null
      or category.household_id is null
      or expense.household_id is distinct from category.household_id
    );

  select count(*)
  into invalid_commitment_cards
  from public.financial_commitments as commitment
  left join public.cards as card on card.id = commitment.payment_method_id
  where commitment.payment_method_id is not null
    and (
      commitment.household_id is null
      or card.household_id is null
      or commitment.household_id is distinct from card.household_id
    );

  select count(*)
  into invalid_commitment_categories
  from public.financial_commitments as commitment
  left join public.categories as category on category.id = commitment.category_id
  where commitment.category_id is not null
    and (
      commitment.household_id is null
      or category.household_id is null
      or commitment.household_id is distinct from category.household_id
    );

  select count(*)
  into invalid_fixed_monthly_values
  from public.fixed_expense_monthly_values as monthly_value
  left join public.fixed_expenses as fixed
    on fixed.id = monthly_value.fixed_expense_id
  where monthly_value.fixed_expense_id is not null
    and (
      monthly_value.household_id is null
      or fixed.household_id is null
      or monthly_value.household_id is distinct from fixed.household_id
    );

  if invalid_expense_cards
      + invalid_expense_categories
      + invalid_commitment_cards
      + invalid_commitment_categories
      + invalid_fixed_monthly_values > 0 then
    raise exception 'Cross-household or orphaned finance relations were found'
      using errcode = '23514',
            detail = format(
              'expenses.card_id=%s, expenses.category_id=%s, financial_commitments.payment_method_id=%s, financial_commitments.category_id=%s, fixed_expense_monthly_values.fixed_expense_id=%s',
              invalid_expense_cards,
              invalid_expense_categories,
              invalid_commitment_cards,
              invalid_commitment_categories,
              invalid_fixed_monthly_values
            ),
            hint = 'Correct the household_id or relation id explicitly, then rerun. This migration did not delete or rewrite those rows.';
  end if;
end;
$$;

-- Keep the helper hardened even though the preceding cycle migration also
-- defines it. CREATE OR REPLACE preserves callers and policy dependencies.
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

-- Every id used inside a household-scoped RPC must resolve inside that same
-- household. The parent ids are already primary keys; these unique composite
-- indexes provide the tenant-aware keys required by the foreign keys below.
create unique index if not exists cards_household_id_id_v2_uidx
on public.cards (household_id, id);

create unique index if not exists categories_household_id_id_v2_uidx
on public.categories (household_id, id);

create unique index if not exists fixed_expenses_household_id_id_v2_uidx
on public.fixed_expenses (household_id, id);

alter table public.expenses
drop constraint if exists expenses_scoped_relation_household_v2_check;

alter table public.expenses
add constraint expenses_scoped_relation_household_v2_check
check (
  household_id is not null
  or (card_id is null and category_id is null)
) not valid;

alter table public.financial_commitments
drop constraint if exists financial_commitments_scoped_relation_household_v2_check;

alter table public.financial_commitments
add constraint financial_commitments_scoped_relation_household_v2_check
check (
  household_id is not null
  or (payment_method_id is null and category_id is null)
) not valid;

alter table public.fixed_expense_monthly_values
drop constraint if exists fixed_expense_monthly_values_scoped_relation_household_v2_check;

alter table public.fixed_expense_monthly_values
add constraint fixed_expense_monthly_values_scoped_relation_household_v2_check
check (household_id is not null or fixed_expense_id is null) not valid;

alter table public.expenses
drop constraint if exists expenses_card_household_v2_fkey;

alter table public.expenses
add constraint expenses_card_household_v2_fkey
foreign key (household_id, card_id)
references public.cards (household_id, id)
not valid;

alter table public.expenses
drop constraint if exists expenses_category_household_v2_fkey;

alter table public.expenses
add constraint expenses_category_household_v2_fkey
foreign key (household_id, category_id)
references public.categories (household_id, id)
not valid;

alter table public.financial_commitments
drop constraint if exists financial_commitments_payment_household_v2_fkey;

alter table public.financial_commitments
add constraint financial_commitments_payment_household_v2_fkey
foreign key (household_id, payment_method_id)
references public.cards (household_id, id)
not valid;

alter table public.financial_commitments
drop constraint if exists financial_commitments_category_household_v2_fkey;

alter table public.financial_commitments
add constraint financial_commitments_category_household_v2_fkey
foreign key (household_id, category_id)
references public.categories (household_id, id)
not valid;

alter table public.fixed_expense_monthly_values
drop constraint if exists fixed_expense_monthly_values_fixed_household_v2_fkey;

alter table public.fixed_expense_monthly_values
add constraint fixed_expense_monthly_values_fixed_household_v2_fkey
foreign key (household_id, fixed_expense_id)
references public.fixed_expenses (household_id, id)
not valid;

alter table public.expenses
validate constraint expenses_scoped_relation_household_v2_check;

alter table public.financial_commitments
validate constraint financial_commitments_scoped_relation_household_v2_check;

alter table public.fixed_expense_monthly_values
validate constraint fixed_expense_monthly_values_scoped_relation_household_v2_check;

alter table public.expenses
validate constraint expenses_card_household_v2_fkey;

alter table public.expenses
validate constraint expenses_category_household_v2_fkey;

alter table public.financial_commitments
validate constraint financial_commitments_payment_household_v2_fkey;

alter table public.financial_commitments
validate constraint financial_commitments_category_household_v2_fkey;

alter table public.fixed_expense_monthly_values
validate constraint fixed_expense_monthly_values_fixed_household_v2_fkey;

-- Pure calendar calculation shared by the expense trigger. Configured days
-- such as 31 are clamped to the last valid day of shorter months. A purchase
-- made on the closing date remains in that invoice; only later purchases roll
-- to the following invoice.
create or replace function public.calculate_credit_card_billing_dates(
  p_purchase_date date,
  p_closing_day integer,
  p_due_day integer
)
returns table (closing_date date, due_date date)
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  purchase_month_start date;
  invoice_month_start date;
  due_month_start date;
begin
  if p_closing_day not between 1 and 31
    or p_due_day not between 1 and 31 then
    raise exception 'Card closing and due days must be between 1 and 31'
      using errcode = '22023';
  end if;

  purchase_month_start := date_trunc('month', p_purchase_date)::date;
  invoice_month_start := purchase_month_start;

  closing_date := invoice_month_start + (
    least(
      p_closing_day,
      extract(day from (invoice_month_start + interval '1 month - 1 day'))::integer
    ) - 1
  );

  if p_purchase_date > closing_date then
    invoice_month_start := (purchase_month_start + interval '1 month')::date;
    closing_date := invoice_month_start + (
      least(
        p_closing_day,
        extract(day from (invoice_month_start + interval '1 month - 1 day'))::integer
      ) - 1
    );
  end if;

  due_month_start := date_trunc('month', closing_date)::date;
  due_date := due_month_start + (
    least(
      p_due_day,
      extract(day from (due_month_start + interval '1 month - 1 day'))::integer
    ) - 1
  );

  if due_date <= closing_date then
    due_month_start := (due_month_start + interval '1 month')::date;
    due_date := due_month_start + (
      least(
        p_due_day,
        extract(day from (due_month_start + interval '1 month - 1 day'))::integer
      ) - 1
    );
  end if;

  return next;
end;
$$;

revoke all on function public.calculate_credit_card_billing_dates(date, integer, integer)
from public;

-- Invoice dates become database-owned. Existing persisted dates remain frozen
-- on unrelated updates, so later card configuration changes never rewrite
-- history. Inserts and changes to purchase/card/household are recalculated from
-- the referenced card under the same household advisory lock used by closing.
create or replace function public.assign_expense_invoice_dates()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  selected_card public.cards%rowtype;
  calculated_closing_date date;
  calculated_due_date date;
begin
  if tg_op = 'UPDATE'
    and new.household_id is not distinct from old.household_id
    and new.card_id is not distinct from old.card_id
    and new.purchase_date is not distinct from old.purchase_date then
    new.invoice_closing_date := old.invoice_closing_date;
    new.invoice_due_date := old.invoice_due_date;
    return new;
  end if;

  if new.household_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(new.household_id::text, 0)
    );
  end if;

  if new.card_id is null then
    new.invoice_closing_date := null;
    new.invoice_due_date := null;
    return new;
  end if;

  select card.*
  into selected_card
  from public.cards as card
  where card.id = new.card_id
  for share;

  if not found then
    raise exception 'Payment method not found'
      using errcode = '23503';
  end if;

  if selected_card.household_id is distinct from new.household_id then
    raise exception 'Payment method belongs to another household'
      using errcode = '23514';
  end if;

  if coalesce(selected_card.type, 'credit_card') <> 'credit_card' then
    new.invoice_closing_date := null;
    new.invoice_due_date := null;
    return new;
  end if;

  if new.purchase_date is null
    or selected_card.closing_day is null
    or selected_card.due_day is null
    or selected_card.closing_day not between 1 and 31
    or selected_card.due_day not between 1 and 31 then
    raise exception 'Credit card billing configuration is invalid'
      using errcode = '23514';
  end if;

  select dates.closing_date, dates.due_date
  into calculated_closing_date, calculated_due_date
  from public.calculate_credit_card_billing_dates(
    new.purchase_date::date,
    selected_card.closing_day,
    selected_card.due_day
  ) as dates;

  new.invoice_closing_date := calculated_closing_date;
  new.invoice_due_date := calculated_due_date;
  return new;
end;
$$;

revoke all on function public.assign_expense_invoice_dates() from public;

drop trigger if exists expenses_10_assign_invoice_dates on public.expenses;

-- PostgreSQL executes same-timing triggers alphabetically. The 10-prefix makes
-- assignment run before expenses_guard_closed_cycle validates NEW dates.
create trigger expenses_10_assign_invoice_dates
before insert or update of
  household_id,
  card_id,
  purchase_date,
  invoice_closing_date,
  invoice_due_date
on public.expenses
for each row execute function public.assign_expense_invoice_dates();

-- Normalize the persisted state so every consumer, including older clients,
-- sees a 12/12 commitment as finished. Explicitly finished early commitments
-- remain finished; this trigger never reactivates them.
create or replace function public.normalize_financial_commitment_completion()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if coalesce(new.total_installments, 0) > 0
    and coalesce(new.current_installment, 0) >= new.total_installments then
    new.status := 'finished';
  elsif new.status is null then
    new.status := 'active';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_financial_commitment_completion()
from public;

drop trigger if exists financial_commitments_10_normalize_completion
on public.financial_commitments;

create trigger financial_commitments_10_normalize_completion
before insert or update of current_installment, total_installments, status
on public.financial_commitments
for each row execute function public.normalize_financial_commitment_completion();

update public.financial_commitments
set status = 'finished',
    updated_at = now()
where coalesce(total_installments, 0) > 0
  and coalesce(current_installment, 0) >= total_installments
  and status is distinct from 'finished';

commit;

-- Read-path indexes. These are non-unique and do not reinterpret existing
-- rows. For a very large production table, create them CONCURRENTLY in a
-- separate maintenance step instead of running this section inside a wrapper
-- transaction supplied by a migration platform.
drop index if exists public.expenses_household_effective_date_idx;

create index expenses_household_effective_date_idx
on public.expenses (
  household_id,
  (coalesce(invoice_closing_date, purchase_date::date))
);

create index if not exists expenses_household_purchase_created_id_idx
on public.expenses (household_id, purchase_date desc, created_at desc, id desc);

create index if not exists expenses_household_card_idx
on public.expenses (household_id, card_id)
where card_id is not null;

create index if not exists expenses_household_category_idx
on public.expenses (household_id, category_id)
where category_id is not null;

create index if not exists income_entries_household_entry_date_id_idx
on public.income_entries (household_id, entry_date desc, id desc);

create index if not exists fixed_expense_monthly_values_household_reference_idx
on public.fixed_expense_monthly_values (household_id, year, month, fixed_expense_id);

create index if not exists fixed_expense_monthly_values_household_fixed_idx
on public.fixed_expense_monthly_values (household_id, fixed_expense_id)
where fixed_expense_id is not null;

create index if not exists financial_commitments_household_payment_idx
on public.financial_commitments (household_id, payment_method_id)
where payment_method_id is not null;

create index if not exists financial_commitments_household_category_idx
on public.financial_commitments (household_id, category_id)
where category_id is not null;

create index if not exists financial_commitments_household_created_id_idx
on public.financial_commitments (household_id, created_at desc, id desc);

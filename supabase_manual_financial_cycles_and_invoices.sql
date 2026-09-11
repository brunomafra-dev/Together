begin;

-- This migration extends the complementary finance tables instead of
-- recreating them. Fail early with an actionable message on a new database.
do $$
begin
  if to_regclass('public.income_entries') is null
    or to_regclass('public.fixed_expense_monthly_values') is null
    or to_regclass('public.goals') is null
    or to_regclass('public.financial_commitments') is null then
    raise exception 'Missing finance prerequisites for manual cycles'
      using hint = 'Apply supabase_income_entries.sql, supabase_fixed_expense_monthly_values.sql and supabase_goals_commitments.sql first.';
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

create table if not exists public.household_finance_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  active_month integer not null check (active_month between 1 and 12),
  active_year integer not null check (active_year between 2000 and 2100),
  active_cycle_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_finance_state enable row level security;

drop policy if exists "household_finance_state_select_member"
on public.household_finance_state;

drop policy if exists "household_finance_state_write_member"
on public.household_finance_state;

create policy "household_finance_state_select_member"
on public.household_finance_state for select to authenticated
using (public.is_household_member(household_id));

-- State mutations are RPC-only so stale clients cannot advance or rewind a
-- household cycle without the database locks and validations below.

-- A financial cycle is opened and closed manually, so its actual start date
-- must be stored independently from the month/year used as its display label.
alter table if exists public.household_finance_state
add column if not exists active_cycle_start_date date;

-- Snapshots keep the inclusive dates of the cycle that was actually closed.
alter table if exists public.monthly_snapshots
add column if not exists cycle_start_date date;

alter table if exists public.monthly_snapshots
add column if not exists cycle_end_date date;

alter table if exists public.monthly_snapshots
add column if not exists expense_rows jsonb not null default '[]'::jsonb;

-- Invoice dates are persisted on the expense so later changes to a card's
-- closing or due day do not move historical purchases between invoices.
alter table if exists public.expenses
add column if not exists invoice_closing_date date;

alter table if exists public.expenses
add column if not exists invoice_due_date date;

-- The current app always writes this flag together with the invoice dates.
-- Keeping it in this self-contained migration prevents a missing optional
-- migration from discarding the persisted card billing assignment.
alter table if exists public.expenses
add column if not exists recurring_monthly boolean not null default false;

-- Category support is required by the authoritative commitment totals below.
alter table public.financial_commitments
add column if not exists category_id uuid references public.categories(id) on delete set null;

-- Existing cycles used calendar months. Preserve that behavior when deriving
-- their initial start date.
update public.household_finance_state
set active_cycle_start_date = make_date(active_year, active_month, 1)
where active_cycle_start_date is null
  and active_month between 1 and 12
  and active_year between 2000 and 2100;

-- Existing snapshots also represented full calendar months. These dates can
-- therefore be reconstructed without changing their historical totals.
update public.monthly_snapshots
set cycle_start_date = coalesce(cycle_start_date, make_date(year, month, 1)),
    cycle_end_date = coalesce(
      cycle_end_date,
      (make_date(year, month, 1) + interval '1 month - 1 day')::date
    )
where (cycle_start_date is null or cycle_end_date is null)
  and month between 1 and 12
  and year between 2000 and 2100;

alter table public.household_finance_state
alter column active_cycle_start_date set not null;

alter table public.monthly_snapshots
alter column cycle_start_date set not null;

alter table public.monthly_snapshots
alter column cycle_end_date set not null;

-- Derive the invoice closing date for existing credit-card purchases whenever
-- both the purchase date and the card's closing day are known. Days such as 31
-- are clamped to the last valid day of shorter months. Rows whose current
-- effective date is already closed are never backfilled, which keeps reruns
-- idempotent after the history guard exists.
with closing_candidates as (
  select
    expenses.id,
    expenses.purchase_date::date as purchase_date,
    cards.closing_day,
    date_trunc('month', expenses.purchase_date)::date as purchase_month_start
  from public.expenses
  join public.cards
    on cards.id = expenses.card_id
    and cards.household_id = expenses.household_id
  where expenses.invoice_closing_date is null
    and expenses.purchase_date is not null
    and cards.closing_day between 1 and 31
    and coalesce(cards.type, 'credit_card') = 'credit_card'
    and not exists (
      select 1
      from public.monthly_snapshots as snapshot
      where snapshot.household_id = expenses.household_id
        and coalesce(expenses.invoice_due_date, expenses.purchase_date::date)
          between snapshot.cycle_start_date and snapshot.cycle_end_date
    )
), invoice_months as (
  select
    id,
    closing_day,
    case
      when purchase_date <= purchase_month_start + (
        least(
          closing_day,
          extract(
            day from (purchase_month_start + interval '1 month - 1 day')
          )::integer
        ) - 1
      )
        then purchase_month_start
      else (purchase_month_start + interval '1 month')::date
    end as invoice_month_start
  from closing_candidates
), closing_schedule as (
  select
    id,
    invoice_month_start + (
      least(
        closing_day,
        extract(
          day from (invoice_month_start + interval '1 month - 1 day')
        )::integer
      ) - 1
    ) as invoice_closing_date
  from invoice_months
)
update public.expenses
set invoice_closing_date = closing_schedule.invoice_closing_date
from closing_schedule
where expenses.id = closing_schedule.id
  and expenses.invoice_closing_date is null;

-- Due dates are calculated from the persisted closing date. If the due day in
-- the closing month has already passed, the due date belongs to the next month.
-- Both the old purchase date and the calculated due date must be outside every
-- frozen cycle before this legacy-null backfill may update the row.
with due_candidates as (
  select
    expenses.id,
    expenses.invoice_closing_date,
    cards.due_day,
    date_trunc('month', expenses.invoice_closing_date)::date as closing_month_start
  from public.expenses
  join public.cards
    on cards.id = expenses.card_id
    and cards.household_id = expenses.household_id
  where expenses.invoice_due_date is null
    and expenses.invoice_closing_date is not null
    and cards.due_day between 1 and 31
    and coalesce(cards.type, 'credit_card') = 'credit_card'
    and not exists (
      select 1
      from public.monthly_snapshots as snapshot
      where snapshot.household_id = expenses.household_id
        and expenses.purchase_date::date
          between snapshot.cycle_start_date and snapshot.cycle_end_date
    )
), due_months as (
  select
    id,
    due_day,
    case
      when closing_month_start + (
        least(
          due_day,
          extract(
            day from (closing_month_start + interval '1 month - 1 day')
          )::integer
        ) - 1
      ) > invoice_closing_date
        then closing_month_start
      else (closing_month_start + interval '1 month')::date
    end as due_month_start
  from due_candidates
), due_schedule as (
  select
    id,
    due_month_start + (
      least(
        due_day,
        extract(day from (due_month_start + interval '1 month - 1 day'))::integer
      ) - 1
    ) as invoice_due_date
  from due_months
)
update public.expenses
set invoice_due_date = due_schedule.invoice_due_date
from due_schedule
where expenses.id = due_schedule.id
  and expenses.invoice_due_date is null
  and not exists (
    select 1
    from public.monthly_snapshots as snapshot
    where snapshot.household_id = expenses.household_id
      and due_schedule.invoice_due_date
        between snapshot.cycle_start_date and snapshot.cycle_end_date
  );

alter table if exists public.monthly_snapshots
drop constraint if exists monthly_snapshots_cycle_dates_check;

alter table if exists public.monthly_snapshots
add constraint monthly_snapshots_cycle_dates_check
check (
  (cycle_start_date is null and cycle_end_date is null)
  or (
    cycle_start_date is not null
    and cycle_end_date is not null
    and cycle_end_date >= cycle_start_date
  )
);

alter table if exists public.expenses
drop constraint if exists expenses_invoice_dates_check;

alter table if exists public.expenses
add constraint expenses_invoice_dates_check
check (
  invoice_closing_date is null
  or invoice_due_date is null
  or invoice_due_date >= invoice_closing_date
);

create index if not exists monthly_snapshots_cycle_dates_idx
on public.monthly_snapshots (household_id, cycle_start_date, cycle_end_date);

create unique index if not exists monthly_snapshots_household_reference_uidx
on public.monthly_snapshots (household_id, year, month);

create index if not exists expenses_household_invoice_closing_idx
on public.expenses (household_id, invoice_closing_date)
where invoice_closing_date is not null;

create index if not exists expenses_household_invoice_due_idx
on public.expenses (household_id, invoice_due_date)
where invoice_due_date is not null;

create index if not exists expenses_household_recurring_monthly_idx
on public.expenses (household_id, recurring_monthly, purchase_date);

-- Snapshots are immutable outside the close/reopen RPCs. Drop policy names
-- used by both historical setup scripts so old clients cannot bypass them.
drop policy if exists "insert own monthly snapshots" on public.monthly_snapshots;
drop policy if exists "delete own monthly snapshots" on public.monthly_snapshots;
drop policy if exists "monthly_snapshots_insert_member" on public.monthly_snapshots;
drop policy if exists "monthly_snapshots_delete_member" on public.monthly_snapshots;

comment on column public.household_finance_state.active_cycle_start_date is
'Inclusive start date of the currently open, manually closed financial cycle.';

comment on column public.monthly_snapshots.cycle_start_date is
'Inclusive start date of the financial cycle represented by this snapshot.';

comment on column public.monthly_snapshots.cycle_end_date is
'Inclusive end date of the manually closed financial cycle represented by this snapshot.';

comment on column public.monthly_snapshots.expense_rows is
'Frozen expense details used by history and CSV exports after the cycle is closed.';

comment on column public.expenses.invoice_closing_date is
'Persisted card invoice closing date assigned when the purchase is recorded.';

comment on column public.expenses.invoice_due_date is
'Persisted card invoice due date assigned when the purchase is recorded.';

-- Persist the first open cycle without allowing a client to overwrite an
-- existing state. Later transitions happen only in close/reopen RPCs.
create or replace function public.initialize_financial_cycle_state(
  p_household_id uuid,
  p_active_month integer,
  p_active_year integer,
  p_active_cycle_start_date date
)
returns public.household_finance_state
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  initialized_state public.household_finance_state;
begin
  if p_household_id is null
    or p_active_month is null
    or p_active_year is null
    or p_active_cycle_start_date is null
    or p_active_month not between 1 and 12
    or p_active_year not between 2000 and 2100 then
    raise exception 'Initial financial cycle is invalid' using errcode = '22007';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'User is not a member of this household' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  perform 1
  from public.household_members
  where household_id = p_household_id
    and profile_id = auth.uid()
  for share;

  if not found then
    raise exception 'User is no longer a member of this household' using errcode = '42501';
  end if;

  insert into public.household_finance_state (
    household_id,
    active_month,
    active_year,
    active_cycle_start_date,
    updated_at
  ) values (
    p_household_id,
    p_active_month,
    p_active_year,
    p_active_cycle_start_date,
    now()
  )
  on conflict (household_id) do nothing;

  select *
  into initialized_state
  from public.household_finance_state
  where household_id = p_household_id;

  if not found then
    raise exception 'Financial cycle state could not be initialized' using errcode = 'P0002';
  end if;

  return initialized_state;
end;
$$;

revoke all on function public.initialize_financial_cycle_state(
  uuid,
  integer,
  integer,
  date
) from public;

grant execute on function public.initialize_financial_cycle_state(
  uuid,
  integer,
  integer,
  date
) to authenticated;

-- Resolve the contractual due date for one installment. On credit cards,
-- started_at is the purchase date; outside a card it is the first due date.
create or replace function public.calculate_financial_commitment_due_date(
  p_started_at date,
  p_installment_offset integer,
  p_card_type text,
  p_closing_day integer,
  p_due_day integer
)
returns date
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  purchase_month_start date;
  closing_month_start date;
  closing_date date;
  due_month_start date;
  first_due_date date;
begin
  if p_started_at is null then
    raise exception 'Commitment start date cannot be null' using errcode = '22004';
  end if;

  if p_installment_offset is null or p_installment_offset < 0 then
    raise exception 'Installment offset must be zero or greater' using errcode = '22023';
  end if;

  if p_card_type is distinct from 'credit_card'
    or p_closing_day is null
    or p_due_day is null then
    first_due_date := p_started_at;
  else
    if p_closing_day not between 1 and 31 or p_due_day not between 1 and 31 then
      raise exception 'Card closing and due days must be between 1 and 31'
        using errcode = '22023';
    end if;

    purchase_month_start := date_trunc('month', p_started_at)::date;
    closing_month_start := purchase_month_start;
    closing_date := closing_month_start + (
      least(
        p_closing_day,
        extract(day from (closing_month_start + interval '1 month - 1 day'))::integer
      ) - 1
    );

    if p_started_at > closing_date then
      closing_month_start := (purchase_month_start + interval '1 month')::date;
      closing_date := closing_month_start + (
        least(
          p_closing_day,
          extract(day from (closing_month_start + interval '1 month - 1 day'))::integer
        ) - 1
      );
    end if;

    due_month_start := date_trunc('month', closing_date)::date;
    first_due_date := due_month_start + (
      least(
        p_due_day,
        extract(day from (due_month_start + interval '1 month - 1 day'))::integer
      ) - 1
    );

    if first_due_date <= closing_date then
      due_month_start := (due_month_start + interval '1 month')::date;
      first_due_date := due_month_start + (
        least(
          p_due_day,
          extract(day from (due_month_start + interval '1 month - 1 day'))::integer
        ) - 1
      );
    end if;
  end if;

  return (first_due_date + make_interval(months => p_installment_offset))::date;
end;
$$;

revoke all on function public.calculate_financial_commitment_due_date(
  date,
  integer,
  text,
  integer,
  integer
) from public;

grant execute on function public.calculate_financial_commitment_due_date(
  date,
  integer,
  text,
  integer,
  integer
) to authenticated;

-- Close the current cycle and open the next one in the same database
-- transaction. The unique snapshot constraint protects against double-clicks
-- and simultaneous closes by both partners.
create or replace function public.close_financial_cycle(
  p_household_id uuid,
  p_month integer,
  p_year integer,
  p_cycle_start_date date,
  p_cycle_end_date date,
  p_next_month integer,
  p_next_year integer,
  p_next_cycle_start_date date,
  p_monthly_income numeric,
  p_total_expenses numeric,
  p_fixed_expenses_total numeric,
  p_installment_expenses_total numeric,
  p_remaining_balance numeric,
  p_category_totals jsonb,
  p_card_totals jsonb,
  p_goal_progress jsonb,
  p_financial_health jsonb,
  p_expense_rows jsonb,
  p_closed_at timestamptz
)
returns public.monthly_snapshots
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  created_snapshot public.monthly_snapshots;
  current_state public.household_finance_state%rowtype;
  expected_next_month integer;
  expected_next_year integer;
  database_expense_signature jsonb;
  client_expense_signature jsonb;
  database_category_signature jsonb;
  client_category_signature jsonb;
  database_card_signature jsonb;
  client_card_signature jsonb;
  database_goal_signature jsonb;
  client_goal_signature jsonb;
  database_variable_total numeric;
  database_fixed_total numeric;
  database_installment_total numeric;
  database_monthly_income numeric;
begin
  if p_household_id is null
    or p_month is null
    or p_year is null
    or p_cycle_start_date is null
    or p_cycle_end_date is null
    or p_next_month is null
    or p_next_year is null
    or p_next_cycle_start_date is null
    or p_monthly_income is null
    or p_total_expenses is null
    or p_fixed_expenses_total is null
    or p_installment_expenses_total is null
    or p_remaining_balance is null then
    raise exception 'Financial cycle fields cannot be null' using errcode = '22004';
  end if;

  if p_month not between 1 and 12
    or p_next_month not between 1 and 12
    or p_year not between 2000 and 2100
    or p_next_year not between 2000 and 2100 then
    raise exception 'Financial cycle reference is invalid' using errcode = '22007';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'User is not a member of this household' using errcode = '42501';
  end if;

  if p_cycle_end_date < p_cycle_start_date then
    raise exception 'Cycle end cannot precede cycle start' using errcode = '22007';
  end if;

  if p_next_cycle_start_date <> p_cycle_end_date + 1 then
    raise exception 'The next cycle must start immediately after the closed cycle'
      using errcode = '22007';
  end if;

  if p_next_cycle_start_date > current_date then
    raise exception 'A financial cycle cannot be closed using a future date'
      using errcode = '22007';
  end if;

  expected_next_month := case when p_month = 12 then 1 else p_month + 1 end;
  expected_next_year := case when p_month = 12 then p_year + 1 else p_year end;

  if p_next_month <> expected_next_month or p_next_year <> expected_next_year then
    raise exception 'The next financial reference is invalid' using errcode = '22007';
  end if;

  -- Serialize every close/reopen operation for this household, including the
  -- first close before a state row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  perform 1
  from public.household_members
  where household_id = p_household_id
    and profile_id = auth.uid()
  for share;

  if not found then
    raise exception 'User is no longer a member of this household' using errcode = '42501';
  end if;

  -- A lock on the parent household serializes other child-table inserts
  -- through their foreign keys. Expense and income mutations use the same
  -- advisory lock in their guards, including operations that began first.
  perform 1
  from public.households
  where id = p_household_id
  for update;

  if not found then
    raise exception 'Household not found' using errcode = 'P0002';
  end if;

  insert into public.household_finance_state (
    household_id,
    active_month,
    active_year,
    active_cycle_start_date,
    updated_at
  ) values (
    p_household_id,
    p_month,
    p_year,
    p_cycle_start_date,
    now()
  )
  on conflict (household_id) do nothing;

  select *
  into current_state
  from public.household_finance_state
  where household_id = p_household_id
  for update;

  if not found then
    raise exception 'Financial cycle state not found' using errcode = 'P0002';
  end if;

  if current_state.active_month <> p_month
    or current_state.active_year <> p_year
    or current_state.active_cycle_start_date is distinct from p_cycle_start_date then
    raise exception 'The financial cycle changed in another session. Reload and try again'
      using errcode = '40001';
  end if;

  perform 1
  from public.fixed_expenses
  where household_id = p_household_id
  for update;

  perform 1
  from public.fixed_expense_monthly_values
  where household_id = p_household_id
  for update;

  perform 1
  from public.financial_commitments
  where household_id = p_household_id
  for update;

  perform 1
  from public.categories
  where household_id = p_household_id
  for update;

  perform 1
  from public.cards
  where household_id = p_household_id
  for update;

  perform 1
  from public.goals
  where household_id = p_household_id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', expense.id::text,
        'purchaseDate', expense.purchase_date::date::text,
        'effectiveDate', coalesce(expense.invoice_closing_date, expense.purchase_date::date)::text,
        'invoiceClosingDate', expense.invoice_closing_date::text,
        'invoiceDueDate', expense.invoice_due_date::text,
        'description', coalesce(expense.description, ''),
        'categoryId', coalesce(expense.category_id::text, ''),
        'paymentMethodId', expense.card_id::text,
        'paidById', coalesce(expense.paid_by, expense.created_by::text, ''),
        'amount', round(expense.amount, 2)
      )
      order by expense.id
    ),
    '[]'::jsonb
  )
  into database_expense_signature
  from public.expenses as expense
  where expense.household_id = p_household_id
    and coalesce(expense.invoice_closing_date, expense.purchase_date::date)
      between p_cycle_start_date and p_cycle_end_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item ->> 'id',
        'purchaseDate', item ->> 'purchaseDate',
        'effectiveDate', item ->> 'effectiveDate',
        'invoiceClosingDate', item ->> 'invoiceClosingDate',
        'invoiceDueDate', item ->> 'invoiceDueDate',
        'description', coalesce(item ->> 'description', ''),
        'categoryId', coalesce(item ->> 'categoryId', ''),
        'paymentMethodId', item ->> 'paymentMethodId',
        'paidById', coalesce(item ->> 'paidById', ''),
        'amount', round((item ->> 'amount')::numeric, 2)
      )
      order by item ->> 'id'
    ),
    '[]'::jsonb
  )
  into client_expense_signature
  from jsonb_array_elements(coalesce(p_expense_rows, '[]'::jsonb)) as source(item);

  if database_expense_signature is distinct from client_expense_signature then
    raise exception 'Expenses changed while the cycle was open. Reload and review before closing'
      using errcode = '40001';
  end if;

  select coalesce(sum(expense.amount), 0)
  into database_variable_total
  from public.expenses as expense
  where expense.household_id = p_household_id
    and coalesce(expense.invoice_closing_date, expense.purchase_date::date)
      between p_cycle_start_date and p_cycle_end_date;

  select coalesce(monthly_income, 0)
  into database_monthly_income
  from public.households
  where id = p_household_id;

  select database_monthly_income + coalesce(sum(income.amount), 0)
  into database_monthly_income
  from public.income_entries as income
  where income.household_id = p_household_id
    and income.entry_date between p_cycle_start_date and p_cycle_end_date;

  select coalesce(
    sum(
      case
        when monthly_value.status = 'confirmed' and monthly_value.actual_amount is not null
          then monthly_value.actual_amount
        else coalesce(monthly_value.estimated_amount, fixed.amount)
      end
    ),
    0
  )
  into database_fixed_total
  from public.fixed_expenses as fixed
  left join public.fixed_expense_monthly_values as monthly_value
    on monthly_value.fixed_expense_id = fixed.id
    and monthly_value.household_id = fixed.household_id
    and monthly_value.month = p_month
    and monthly_value.year = p_year
  where fixed.household_id = p_household_id;

  select coalesce(sum(commitment.installment_value), 0)
  into database_installment_total
  from public.financial_commitments as commitment
  left join public.cards as card
    on card.id = commitment.payment_method_id
    and card.household_id = commitment.household_id
  cross join lateral generate_series(
    greatest(coalesce(commitment.current_installment, 0), 0),
    coalesce(commitment.total_installments, 1) - 1
  ) as installment(month_offset)
  where commitment.household_id = p_household_id
    and commitment.status <> 'finished'
    and coalesce(commitment.current_installment, 0)
      < coalesce(commitment.total_installments, 1)
    and public.calculate_financial_commitment_due_date(
      commitment.started_at,
      installment.month_offset,
      card.type,
      card.closing_day,
      card.due_day
    ) between p_cycle_start_date and p_cycle_end_date;

  if round(coalesce(p_monthly_income, 0), 2) <> round(database_monthly_income, 2)
    or round(coalesce(p_fixed_expenses_total, 0), 2) <> round(database_fixed_total, 2)
    or round(coalesce(p_installment_expenses_total, 0), 2)
      <> round(database_installment_total, 2)
    or round(coalesce(p_total_expenses, 0), 2)
      <> round(database_variable_total + database_fixed_total + database_installment_total, 2)
    or round(coalesce(p_remaining_balance, 0), 2)
      <> round(
        database_monthly_income
          - database_variable_total
          - database_fixed_total
          - database_installment_total,
        2
      ) then
    raise exception 'Financial data changed while the cycle was open. Reload before closing'
      using errcode = '40001';
  end if;

  with category_amounts as (
    select
      coalesce(nullif(category.name, ''), expense.category_id::text, 'Sem categoria') as name,
      expense.amount
    from public.expenses as expense
    left join public.categories as category
      on category.id = expense.category_id
      and category.household_id = expense.household_id
    where expense.household_id = p_household_id
      and coalesce(expense.invoice_closing_date, expense.purchase_date::date)
        between p_cycle_start_date and p_cycle_end_date

    union all

    select
      coalesce(nullif(fixed.category, ''), 'Sem categoria') as name,
      case
        when monthly_value.status = 'confirmed' and monthly_value.actual_amount is not null
          then monthly_value.actual_amount
        else coalesce(monthly_value.estimated_amount, fixed.amount)
      end as amount
    from public.fixed_expenses as fixed
    left join public.fixed_expense_monthly_values as monthly_value
      on monthly_value.fixed_expense_id = fixed.id
      and monthly_value.household_id = fixed.household_id
      and monthly_value.month = p_month
      and monthly_value.year = p_year
    where fixed.household_id = p_household_id

    union all

    select
      coalesce(nullif(category.name, ''), commitment.category_id::text, 'Parcelas') as name,
      commitment.installment_value as amount
    from public.financial_commitments as commitment
    left join public.categories as category
      on category.id = commitment.category_id
      and category.household_id = commitment.household_id
    left join public.cards as card
      on card.id = commitment.payment_method_id
      and card.household_id = commitment.household_id
    cross join lateral generate_series(
      greatest(coalesce(commitment.current_installment, 0), 0),
      coalesce(commitment.total_installments, 1) - 1
    ) as installment(month_offset)
    where commitment.household_id = p_household_id
      and commitment.status <> 'finished'
      and coalesce(commitment.current_installment, 0)
        < coalesce(commitment.total_installments, 1)
      and public.calculate_financial_commitment_due_date(
        commitment.started_at,
        installment.month_offset,
        card.type,
        card.closing_day,
        card.due_day
      ) between p_cycle_start_date and p_cycle_end_date
  ), grouped_categories as (
    select name, sum(amount) as amount
    from category_amounts
    group by name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', name, 'amount', round(amount, 2))
      order by name
    ),
    '[]'::jsonb
  )
  into database_category_signature
  from grouped_categories;

  with grouped_categories as (
    select
      coalesce(item ->> 'name', 'Sem categoria') as name,
      sum((item ->> 'amount')::numeric) as amount
    from jsonb_array_elements(coalesce(p_category_totals, '[]'::jsonb)) as source(item)
    group by coalesce(item ->> 'name', 'Sem categoria')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', name, 'amount', round(amount, 2))
      order by name
    ),
    '[]'::jsonb
  )
  into client_category_signature
  from grouped_categories;

  if database_category_signature is distinct from client_category_signature then
    raise exception 'Financial categories changed while the cycle was open. Reload before closing'
      using errcode = '40001';
  end if;

  with card_amounts as (
    select
      card.id::text as id,
      coalesce(card.name, '') as name,
      coalesce(sum(expense.amount), 0) as amount,
      card.limit_amount
    from public.cards as card
    left join public.expenses as expense
      on expense.card_id = card.id
      and expense.household_id = card.household_id
      and coalesce(expense.invoice_closing_date, expense.purchase_date::date)
        between p_cycle_start_date and p_cycle_end_date
    where card.household_id = p_household_id
      and coalesce(card.type, 'credit_card') = 'credit_card'
    group by card.id, card.name, card.limit_amount
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'amount', round(amount, 2),
        'limitAmount', round(limit_amount::numeric, 2),
        'availableLimit', case
          when limit_amount is null then null
          else round(limit_amount::numeric - amount, 2)
        end
      )
      order by id
    ),
    '[]'::jsonb
  )
  into database_card_signature
  from card_amounts;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item ->> 'id',
        'name', coalesce(item ->> 'name', ''),
        'amount', round((item ->> 'amount')::numeric, 2),
        'limitAmount', round((item ->> 'limitAmount')::numeric, 2),
        'availableLimit', round((item ->> 'availableLimit')::numeric, 2)
      )
      order by item ->> 'id'
    ),
    '[]'::jsonb
  )
  into client_card_signature
  from jsonb_array_elements(coalesce(p_card_totals, '[]'::jsonb)) as source(item);

  if database_card_signature is distinct from client_card_signature then
    raise exception 'Credit card data changed while the cycle was open. Reload before closing'
      using errcode = '40001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', goal.id::text,
        'title', goal.title,
        'currentAmount', round(goal.current_amount, 2),
        'targetAmount', round(goal.target_amount, 2)
      )
      order by goal.id
    ),
    '[]'::jsonb
  )
  into database_goal_signature
  from public.goals as goal
  where goal.household_id = p_household_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item ->> 'id',
        'title', item ->> 'title',
        'currentAmount', round((item ->> 'currentAmount')::numeric, 2),
        'targetAmount', round((item ->> 'targetAmount')::numeric, 2)
      )
      order by item ->> 'id'
    ),
    '[]'::jsonb
  )
  into client_goal_signature
  from jsonb_array_elements(coalesce(p_goal_progress, '[]'::jsonb)) as source(item);

  if database_goal_signature is distinct from client_goal_signature then
    raise exception 'Goals changed while the cycle was open. Reload before closing'
      using errcode = '40001';
  end if;

  insert into public.monthly_snapshots (
    household_id,
    month,
    year,
    cycle_start_date,
    cycle_end_date,
    expense_rows,
    monthly_income,
    total_expenses,
    fixed_expenses_total,
    installment_expenses_total,
    remaining_balance,
    category_totals,
    card_totals,
    goal_progress,
    financial_health,
    closed_at
  ) values (
    p_household_id,
    p_month,
    p_year,
    p_cycle_start_date,
    p_cycle_end_date,
    coalesce(p_expense_rows, '[]'::jsonb),
    database_monthly_income,
    database_variable_total + database_fixed_total + database_installment_total,
    database_fixed_total,
    database_installment_total,
    database_monthly_income
      - database_variable_total
      - database_fixed_total
      - database_installment_total,
    coalesce(p_category_totals, '[]'::jsonb),
    coalesce(p_card_totals, '[]'::jsonb),
    coalesce(p_goal_progress, '[]'::jsonb),
    coalesce(p_financial_health, '{}'::jsonb),
    now()
  )
  returning * into created_snapshot;

  update public.household_finance_state
  set active_month = p_next_month,
      active_year = p_next_year,
      active_cycle_start_date = p_next_cycle_start_date,
      updated_at = now()
  where household_id = p_household_id;

  return created_snapshot;
end;
$$;

revoke all on function public.close_financial_cycle(
  uuid,
  integer,
  integer,
  date,
  date,
  integer,
  integer,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) from public;

grant execute on function public.close_financial_cycle(
  uuid,
  integer,
  integer,
  date,
  date,
  integer,
  integer,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) to authenticated;

create or replace function public.reopen_financial_cycle(p_snapshot_id uuid)
returns public.monthly_snapshots
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  reopened_snapshot public.monthly_snapshots;
  current_state public.household_finance_state%rowtype;
  expected_active_month integer;
  expected_active_year integer;
begin
  select *
  into reopened_snapshot
  from public.monthly_snapshots
  where id = p_snapshot_id
    and public.is_household_member(household_id);

  if reopened_snapshot.id is null then
    raise exception 'Financial snapshot not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(reopened_snapshot.household_id::text, 0));

  perform 1
  from public.household_members
  where household_id = reopened_snapshot.household_id
    and profile_id = auth.uid()
  for share;

  if not found then
    raise exception 'User is no longer a member of this household' using errcode = '42501';
  end if;

  -- Re-read under the household lock in case another session closed or
  -- reopened a cycle while this request was waiting.
  select *
  into reopened_snapshot
  from public.monthly_snapshots
  where id = p_snapshot_id
  for update;

  if not found then
    raise exception 'Financial snapshot no longer exists' using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.monthly_snapshots
    where household_id = reopened_snapshot.household_id
      and cycle_end_date > reopened_snapshot.cycle_end_date
  ) then
    raise exception 'Reopen the latest financial cycle first' using errcode = 'P0001';
  end if;

  expected_active_month := case
    when reopened_snapshot.month = 12 then 1
    else reopened_snapshot.month + 1
  end;
  expected_active_year := case
    when reopened_snapshot.month = 12 then reopened_snapshot.year + 1
    else reopened_snapshot.year
  end;

  select *
  into current_state
  from public.household_finance_state
  where household_id = reopened_snapshot.household_id
  for update;

  if not found then
    raise exception 'Financial cycle state not found' using errcode = 'P0002';
  end if;

  if current_state.active_month <> expected_active_month
    or current_state.active_year <> expected_active_year
    or current_state.active_cycle_start_date is distinct from reopened_snapshot.cycle_end_date + 1 then
    raise exception 'The financial cycle changed in another session. Reload and try again'
      using errcode = '40001';
  end if;

  update public.household_finance_state
  set active_month = reopened_snapshot.month,
      active_year = reopened_snapshot.year,
      active_cycle_start_date = reopened_snapshot.cycle_start_date,
      updated_at = now()
  where household_id = reopened_snapshot.household_id;

  delete from public.monthly_snapshots where id = p_snapshot_id;
  return reopened_snapshot;
end;
$$;

revoke all on function public.reopen_financial_cycle(uuid) from public;
grant execute on function public.reopen_financial_cycle(uuid) to authenticated;

-- Closed history is authoritative. These guards prevent stale clients from
-- changing a transaction that already belongs to a frozen cycle.
create or replace function public.guard_closed_cycle_expense()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  target_household_id uuid;
begin
  if tg_op = 'UPDATE' and new.household_id is distinct from old.household_id then
    raise exception 'An expense cannot be moved to another household'
      using errcode = '23514';
  end if;

  target_household_id := case when tg_op = 'DELETE' then old.household_id else new.household_id end;

  if target_household_id is not null then
    -- Serialize direct transaction changes with close/reopen. The locking read
    -- happens after any concurrent close commits, so the checks below validate
    -- against the newly frozen snapshot instead of stale state.
    perform pg_advisory_xact_lock(hashtextextended(target_household_id::text, 0));
    perform 1
    from public.household_finance_state
    where household_id = target_household_id
    for update;
  end if;

  if tg_op <> 'INSERT' and exists (
    select 1
    from public.monthly_snapshots as snapshot
    where snapshot.household_id = old.household_id
      and (
        coalesce(old.invoice_closing_date, old.purchase_date::date)
          between snapshot.cycle_start_date and snapshot.cycle_end_date
        or exists (
          select 1
          from jsonb_array_elements(coalesce(snapshot.expense_rows, '[]'::jsonb)) as item
          where item ->> 'id' = old.id::text
        )
      )
  ) then
    raise exception 'Este gasto pertence a um ciclo fechado. Reabra o ciclo antes de alterá-lo.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and exists (
    select 1
    from public.monthly_snapshots as snapshot
    where snapshot.household_id = new.household_id
      and coalesce(new.invoice_closing_date, new.purchase_date::date)
        between snapshot.cycle_start_date and snapshot.cycle_end_date
  ) then
    raise exception 'Não é possível lançar um gasto dentro de um ciclo já fechado.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_closed_cycle_expense() from public;

drop trigger if exists expenses_guard_closed_cycle on public.expenses;
create trigger expenses_guard_closed_cycle
before insert or update or delete on public.expenses
for each row execute function public.guard_closed_cycle_expense();

create or replace function public.guard_closed_cycle_income()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  target_household_id uuid;
begin
  if tg_op = 'UPDATE' and new.household_id is distinct from old.household_id then
    raise exception 'An income entry cannot be moved to another household'
      using errcode = '23514';
  end if;

  target_household_id := case when tg_op = 'DELETE' then old.household_id else new.household_id end;

  if target_household_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(target_household_id::text, 0));
    perform 1
    from public.household_finance_state
    where household_id = target_household_id
    for update;
  end if;

  if tg_op <> 'INSERT' and exists (
    select 1
    from public.monthly_snapshots
    where household_id = old.household_id
      and old.entry_date::date between cycle_start_date and cycle_end_date
  ) then
    raise exception 'Esta renda pertence a um ciclo fechado. Reabra o ciclo antes de alterá-la.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and exists (
    select 1
    from public.monthly_snapshots
    where household_id = new.household_id
      and new.entry_date::date between cycle_start_date and cycle_end_date
  ) then
    raise exception 'Não é possível lançar uma renda dentro de um ciclo já fechado.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_closed_cycle_income() from public;

drop trigger if exists income_entries_guard_closed_cycle on public.income_entries;
create trigger income_entries_guard_closed_cycle
before insert or update or delete on public.income_entries
for each row execute function public.guard_closed_cycle_income();

commit;

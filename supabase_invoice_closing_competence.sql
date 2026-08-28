begin;

-- Card purchases belong to the financial cycle containing the persisted
-- statement closing date. The due date remains available for cash-flow
-- information, but no longer moves the purchase into a later budget cycle.
do $$
begin
  if to_regclass('public.expenses') is null
    or to_regclass('public.monthly_snapshots') is null
    or to_regclass('public.household_finance_state') is null then
    raise exception 'Missing prerequisites for invoice closing competence'
      using hint = 'Apply supabase_manual_financial_cycles_and_invoices.sql first.';
  end if;
end;
$$;

do $$
declare
  close_cycle_signature regprocedure := to_regprocedure(
    'public.close_financial_cycle(uuid,integer,integer,date,date,integer,integer,date,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz)'
  );
  function_definition text;
  old_expression constant text :=
    'coalesce(expense.invoice_due_date, expense.purchase_date::date)';
  new_expression constant text :=
    'coalesce(expense.invoice_closing_date, expense.purchase_date::date)';
  replacement_count integer;
begin
  if close_cycle_signature is null then
    raise exception 'Missing function public.close_financial_cycle'
      using hint = 'Apply supabase_manual_financial_cycles_and_invoices.sql first.';
  end if;

  select pg_get_functiondef(close_cycle_signature)
  into function_definition;

  replacement_count := (
    length(function_definition) - length(replace(function_definition, old_expression, ''))
  ) / length(old_expression);

  if replacement_count = 0 and position(new_expression in function_definition) > 0 then
    -- The migration has already been applied.
    null;
  elsif replacement_count = 0 then
    raise exception 'Unexpected close_financial_cycle definition (competence expression not found)'
      using hint = 'Review the deployed function before changing its cycle rules.';
  else
    function_definition := replace(function_definition, old_expression, new_expression);
    if position(old_expression in function_definition) > 0
      or position(new_expression in function_definition) = 0 then
      raise exception 'Could not safely replace all close_financial_cycle competence expressions';
    end if;
    execute function_definition;
  end if;
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
    raise exception 'Este gasto pertence a um ciclo fechado. Reabra o ciclo antes de altera-lo.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and exists (
    select 1
    from public.monthly_snapshots as snapshot
    where snapshot.household_id = new.household_id
      and coalesce(new.invoice_closing_date, new.purchase_date::date)
        between snapshot.cycle_start_date and snapshot.cycle_end_date
  ) then
    raise exception 'Nao e possivel lancar um gasto dentro de um ciclo ja fechado.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_closed_cycle_expense() from public;

comment on function public.guard_closed_cycle_expense() is
'Protects closed financial cycles using invoice closing competence for card purchases.';

commit;

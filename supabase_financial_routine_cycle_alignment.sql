begin;

do $$
begin
  if to_regclass('public.households') is null
    or to_regclass('public.household_finance_state') is null
    or to_regclass('public.expenses') is null
    or to_regclass('public.income_entries') is null
    or to_regclass('public.monthly_snapshots') is null
    or to_regprocedure('public.is_household_member(uuid)') is null then
    raise exception 'Missing prerequisites for financial routine cycle alignment'
      using hint = 'Apply the household, income and manual financial cycle migrations first.';
  end if;
end;
$$;

create or replace function public.align_empty_financial_cycle(
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
  aligned_state public.household_finance_state;
  state_exists boolean;
  has_financial_activity boolean;
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception 'Not authorized to configure this household'
      using errcode = '42501';
  end if;

  if p_active_month not between 1 and 12
    or p_active_year not between 2000 and 2100
    or p_active_cycle_start_date is null
    or p_active_cycle_start_date > current_date
    or extract(month from p_active_cycle_start_date)::integer <> p_active_month
    or extract(year from p_active_cycle_start_date)::integer <> p_active_year then
    raise exception 'Invalid financial cycle reference'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  select *
  into aligned_state
  from public.household_finance_state
  where household_id = p_household_id
  for update;

  state_exists := found;

  select
    exists (select 1 from public.expenses where household_id = p_household_id)
    or exists (select 1 from public.income_entries where household_id = p_household_id)
    or exists (select 1 from public.monthly_snapshots where household_id = p_household_id)
  into has_financial_activity;

  if not state_exists and has_financial_activity then
    raise exception 'Cannot align a household with financial activity and no cycle state'
      using errcode = '23514';
  end if;

  if not state_exists then
    insert into public.household_finance_state (
      household_id,
      active_month,
      active_year,
      active_cycle_start_date
    ) values (
      p_household_id,
      p_active_month,
      p_active_year,
      p_active_cycle_start_date
    )
    returning * into aligned_state;
  end if;

  -- Existing activity is historical state and must never move silently.
  if has_financial_activity then
    return aligned_state;
  end if;

  update public.household_finance_state
  set active_month = p_active_month,
      active_year = p_active_year,
      active_cycle_start_date = p_active_cycle_start_date,
      updated_at = now()
  where household_id = p_household_id
  returning * into aligned_state;

  return aligned_state;
end;
$$;

revoke all on function public.align_empty_financial_cycle(uuid, integer, integer, date) from public;
grant execute on function public.align_empty_financial_cycle(uuid, integer, integer, date)
to authenticated;

comment on function public.align_empty_financial_cycle(uuid, integer, integer, date) is
'Aligns only an empty household cycle to its configured routine and preserves every cycle with financial activity.';

commit;

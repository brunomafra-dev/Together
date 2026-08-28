begin;

do $$
begin
  if to_regclass('public.households') is null then
    raise exception 'Missing table public.households';
  end if;
end;
$$;

alter table public.households
  add column if not exists income_mode text not null default 'fixed',
  add column if not exists primary_income_day integer,
  add column if not exists cycle_mode text not null default 'payment_day',
  add column if not exists cycle_close_day integer,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.households
  drop constraint if exists households_income_mode_check,
  drop constraint if exists households_primary_income_day_check,
  drop constraint if exists households_cycle_mode_check,
  drop constraint if exists households_cycle_close_day_check,
  drop constraint if exists households_payment_day_cycle_check,
  drop constraint if exists households_cycle_configuration_check;

alter table public.households
  add constraint households_income_mode_check
    check (income_mode in ('fixed', 'variable', 'mixed')),
  add constraint households_primary_income_day_check
    check (primary_income_day is null or primary_income_day between 1 and 31),
  add constraint households_cycle_mode_check
    check (cycle_mode in ('payment_day', 'custom_day', 'manual')),
  add constraint households_cycle_close_day_check
    check (cycle_close_day is null or cycle_close_day between 1 and 31),
  add constraint households_cycle_configuration_check
    check (
      onboarding_completed_at is null
      or cycle_mode = 'manual'
      or (cycle_mode = 'payment_day' and primary_income_day is not null)
      or (cycle_mode = 'custom_day' and cycle_close_day is not null)
    );

comment on column public.households.income_mode is
'How the household receives income: fixed, variable or mixed.';
comment on column public.households.primary_income_day is
'Main monthly income day when one exists.';
comment on column public.households.cycle_mode is
'How the financial cycle is closed: payment day, custom day or manual.';
comment on column public.households.cycle_close_day is
'Custom inclusive end day for the financial cycle.';
comment on column public.households.onboarding_completed_at is
'When the household completed or intentionally skipped guided setup.';

commit;

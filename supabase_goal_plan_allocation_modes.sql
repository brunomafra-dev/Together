begin;

do $$
begin
  if to_regclass('public.goal_plan_items') is null then
    raise exception 'Missing table public.goal_plan_items'
      using hint = 'Apply supabase_goals_commitments.sql first.';
  end if;
end;
$$;

alter table public.goal_plan_items
  add column if not exists allocation_mode text not null default 'percentage';

alter table public.goal_plan_items
  drop constraint if exists goal_plan_items_allocation_mode_check;

alter table public.goal_plan_items
  add constraint goal_plan_items_allocation_mode_check
    check (allocation_mode in ('percentage', 'fixed'));

comment on column public.goal_plan_items.allocation_mode is
'Whether amount follows a percentage of income or remains an exact monthly value.';

commit;

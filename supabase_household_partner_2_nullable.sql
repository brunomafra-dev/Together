begin;

-- A household is created as soon as the first person signs up. At that point
-- the second partner is optional, and the client intentionally stores NULL.
-- Keeping this column nullable also lets a profile be saved before both names
-- have been filled in.
do $$
begin
  if to_regclass('public.households') is null then
    raise exception 'Missing table public.households';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'households'
      and column_name = 'partner_2_name'
  ) then
    raise exception 'Missing column public.households.partner_2_name';
  end if;
end;
$$;

alter table public.households
  alter column partner_2_name drop not null;

commit;

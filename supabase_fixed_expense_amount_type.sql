alter table public.fixed_expenses
add column if not exists amount_type text not null default 'fixed'
check (amount_type in ('fixed', 'variable'));

update public.fixed_expenses
set amount_type = 'fixed'
where amount_type is null;

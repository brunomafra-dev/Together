alter table public.expenses
  add column if not exists recurring_monthly boolean not null default false;

create index if not exists expenses_household_recurring_monthly_idx
  on public.expenses (household_id, recurring_monthly, purchase_date);

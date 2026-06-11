alter table public.financial_commitments
add column if not exists category_id uuid references public.categories(id) on delete set null;


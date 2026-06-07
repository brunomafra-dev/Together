begin;

alter table if exists public.cards
add column if not exists type text not null default 'credit_card';

alter table if exists public.cards
drop constraint if exists cards_type_check;

alter table if exists public.cards
add constraint cards_type_check
check (type in ('credit_card', 'debit', 'pix', 'cash'));

update public.cards
set type = case
  when lower(name) = 'pix' then 'pix'
  when lower(name) = 'dinheiro' then 'cash'
  when lower(name) in ('débito', 'debito') then 'debit'
  else coalesce(type, 'credit_card')
end;

update public.cards
set limit_amount = null
where type in ('debit', 'pix', 'cash');

commit;

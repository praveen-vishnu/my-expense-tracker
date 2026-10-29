-- Migration v5: Update check constraints on incomes and budgets to allow >= 0 amounts
-- This ensures that zero-amount updates or clearing values does not violate check constraints.

-- 1. Incomes amount check
alter table public.incomes drop constraint if exists incomes_amount_check;
alter table public.incomes add constraint incomes_amount_check check (amount >= 0);

-- 2. Budgets amount check
alter table public.budgets drop constraint if exists budgets_amount_check;
alter table public.budgets add constraint budgets_amount_check check (amount >= 0);

-- 3. Category budgets amount check (if present)
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where table_schema = 'public' and table_name = 'category_budgets' and constraint_name = 'category_budgets_amount_check'
  ) then
    alter table public.category_budgets drop constraint category_budgets_amount_check;
    alter table public.category_budgets add constraint category_budgets_amount_check check (amount >= 0);
  end if;
end $$;

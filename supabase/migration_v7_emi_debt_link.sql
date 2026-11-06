-- Link recurring EMI schedules to debts so generated installments update loan balances.
-- Safe to run repeatedly after migration_v6_debts.sql.
alter table public.recurring_schedules
  add column if not exists debt_id text default null
  references public.debts(id) on delete set null;

-- ==============================================================================
-- ZERO-DOWNTIME DATA MIGRATION SCRIPT (v1 JSON -> v2 Relational)
-- Safe to run directly in Supabase SQL Editor. Fully idempotent.
-- (Assumes Step 1 schema.sql has already been run to create the tables)
-- ==============================================================================

-- 1. Migrate Categories from existing payloads
insert into public.expense_categories (user_id, name)
select distinct
  d.user_id,
  trim(c.value::text, '"') as name
from public.expense_tracker_data d,
     jsonb_array_elements(d.payload->'categories') as c
where d.payload->'categories' is not null
  and char_length(trim(c.value::text, '"')) > 0
on conflict (user_id, name) do nothing;

-- 2. Migrate Expenses from existing JSON arrays
insert into public.expenses (id, user_id, amount, category, date, note, recurring_id)
select
  e->>'id' as id,
  d.user_id,
  (e->>'amount')::numeric as amount,
  e->>'category' as category,
  (e->>'date')::date as date,
  coalesce(e->>'note', '') as note,
  e->>'recurringId' as recurring_id
from public.expense_tracker_data d,
     jsonb_array_elements(d.payload->'expenses') as e
where d.payload->'expenses' is not null
  and e->>'id' is not null
  and (e->>'amount')::numeric > 0
on conflict (id) do nothing;

-- 3. Migrate Incomes from existing monthly JSON key-values
insert into public.incomes (user_id, month, amount)
select
  d.user_id,
  kv.key as month,
  (kv.value)::numeric as amount
from public.expense_tracker_data d,
     jsonb_each_text(d.payload->'income') as kv
where d.payload->'income' is not null
  and kv.value ~ '^[0-9]+(\.[0-9]+)?$'
  and (kv.value)::numeric > 0
on conflict (user_id, month) do update
set amount = excluded.amount;

-- 4. Migrate Budgets from existing monthly JSON key-values
insert into public.budgets (user_id, month, amount)
select
  d.user_id,
  kv.key as month,
  (kv.value)::numeric as amount
from public.expense_tracker_data d,
     jsonb_each_text(d.payload->'budgets') as kv
where d.payload->'budgets' is not null
  and kv.value ~ '^[0-9]+(\.[0-9]+)?$'
  and (kv.value)::numeric > 0
on conflict (user_id, month) do update
set amount = excluded.amount;

-- 5. Migrate Recurring Schedules from existing JSON arrays
insert into public.recurring_schedules (id, user_id, name, amount, category, note, day, start_month, kind, installments)
select
  r->>'id' as id,
  d.user_id,
  r->>'name' as name,
  (r->>'amount')::numeric as amount,
  r->>'category' as category,
  coalesce(r->>'note', '') as note,
  (r->>'day')::int as day,
  r->>'startMonth' as start_month,
  case when r->>'kind' in ('monthly', 'emi') then r->>'kind' else 'monthly' end as kind,
  case
    when r->>'kind' = 'emi' and r->>'installments' is not null and r->>'installments' ~ '^[0-9]+$'
    then (r->>'installments')::int
    else null
  end as installments
from public.expense_tracker_data d,
     jsonb_array_elements(d.payload->'recurringExpenses') as r
where d.payload->'recurringExpenses' is not null
  and r->>'id' is not null
  and (r->>'amount')::numeric > 0
on conflict (id) do nothing;

-- Summary verification query
select
  (select count(*) from public.expense_tracker_data) as legacy_users_count,
  (select count(*) from public.expenses) as total_migrated_expenses,
  (select count(*) from public.incomes) as total_migrated_incomes,
  (select count(*) from public.budgets) as total_migrated_budgets,
  (select count(*) from public.recurring_schedules) as total_migrated_schedules;

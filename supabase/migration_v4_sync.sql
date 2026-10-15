-- ==============================================================================
-- MILESTONE 4: LOCAL-FIRST PER-ROW SYNC MIGRATION
-- Safe to run in Supabase SQL Editor. Fully idempotent.
-- ==============================================================================

-- 1. Automatic updated_at trigger function
create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Modify existing tables: Add deleted_at tombstones & missing columns

-- Accounts: add billing_day, due_day, deleted_at
alter table public.accounts add column if not exists billing_day int default null;
alter table public.accounts add column if not exists due_day int default null;
alter table public.accounts add column if not exists deleted_at timestamptz default null;
create index if not exists idx_accounts_user_updated on public.accounts(user_id, updated_at);

drop trigger if exists trigger_accounts_updated_at on public.accounts;
create trigger trigger_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_row_updated_at();

-- Expenses: add split jsonb, deleted_at
alter table public.expenses add column if not exists split jsonb default null;
alter table public.expenses add column if not exists deleted_at timestamptz default null;
create index if not exists idx_expenses_user_updated on public.expenses(user_id, updated_at);

drop trigger if exists trigger_expenses_updated_at on public.expenses;
create trigger trigger_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_row_updated_at();

-- Incomes: add account_id, deleted_at
alter table public.incomes add column if not exists account_id text default null references public.accounts(id) on delete set null;
alter table public.incomes add column if not exists deleted_at timestamptz default null;
create index if not exists idx_incomes_user_updated on public.incomes(user_id, updated_at);

drop trigger if exists trigger_incomes_updated_at on public.incomes;
create trigger trigger_incomes_updated_at
  before update on public.incomes
  for each row execute function public.set_row_updated_at();

-- Budgets: add deleted_at
alter table public.budgets add column if not exists deleted_at timestamptz default null;
create index if not exists idx_budgets_user_updated on public.budgets(user_id, updated_at);

drop trigger if exists trigger_budgets_updated_at on public.budgets;
create trigger trigger_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_row_updated_at();

-- Recurring schedules: add account_id, deleted_at
alter table public.recurring_schedules add column if not exists account_id text default null references public.accounts(id) on delete set null;
alter table public.recurring_schedules add column if not exists deleted_at timestamptz default null;
create index if not exists idx_recurring_user_updated on public.recurring_schedules(user_id, updated_at);

drop trigger if exists trigger_recurring_schedules_updated_at on public.recurring_schedules;
create trigger trigger_recurring_schedules_updated_at
  before update on public.recurring_schedules
  for each row execute function public.set_row_updated_at();

-- 3. Create Transfers Table
create table if not exists public.transfers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id text not null,
  to_account_id text not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create index if not exists idx_transfers_user_date on public.transfers(user_id, date desc);
create index if not exists idx_transfers_user_updated on public.transfers(user_id, updated_at);

alter table public.transfers enable row level security;

drop policy if exists "Users can manage own transfers" on public.transfers;
create policy "Users can manage own transfers"
  on public.transfers for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.transfers to authenticated;

drop trigger if exists trigger_transfers_updated_at on public.transfers;
create trigger trigger_transfers_updated_at
  before update on public.transfers
  for each row execute function public.set_row_updated_at();

-- 4. Create Category Budgets Table
create table if not exists public.category_budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create index if not exists idx_cat_budgets_user_month on public.category_budgets(user_id, month);
create index if not exists idx_cat_budgets_user_updated on public.category_budgets(user_id, updated_at);

alter table public.category_budgets enable row level security;

drop policy if exists "Users can manage own category budgets" on public.category_budgets;
create policy "Users can manage own category budgets"
  on public.category_budgets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.category_budgets to authenticated;

drop trigger if exists trigger_cat_budgets_updated_at on public.category_budgets;
create trigger trigger_cat_budgets_updated_at
  before update on public.category_budgets
  for each row execute function public.set_row_updated_at();

-- 5. Verification query
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('transfers', 'category_budgets', 'accounts', 'expenses', 'incomes', 'budgets', 'recurring_schedules')) as synced_tables_count;


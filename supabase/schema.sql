-- Normalized Production Schema with RLS and Migration Path

-- 1. Categories
create table if not exists public.expense_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.expense_categories enable row level security;

drop policy if exists "Users can read their own expense categories" on public.expense_categories;
create policy "Users can read their own expense categories"
  on public.expense_categories for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expense categories" on public.expense_categories;
create policy "Users can insert their own expense categories"
  on public.expense_categories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expense categories" on public.expense_categories;
create policy "Users can update their own expense categories"
  on public.expense_categories for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own expense categories" on public.expense_categories;
create policy "Users can delete their own expense categories"
  on public.expense_categories for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.expense_categories to authenticated;

-- Default category seed trigger
create or replace function public.seed_expense_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.expense_categories (user_id, name)
  select new.id, category
  from unnest(array[
    'Food', 'Transport', 'Shopping', 'Bills', 'EMI',
    'Entertainment', 'Health', 'Travel', 'Education', 'Other'
  ]) as category
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_expense_categories on auth.users;
create trigger on_auth_user_created_seed_expense_categories
  after insert on auth.users
  for each row execute procedure public.seed_expense_categories();

-- 2. Normalized Expenses Table
create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  date date not null,
  note text not null default '',
  recurring_id text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_date on public.expenses(user_id, date desc);
create index if not exists idx_expenses_user_category on public.expenses(user_id, category);

alter table public.expenses enable row level security;

drop policy if exists "Users can read own expenses" on public.expenses;
create policy "Users can read own expenses"
  on public.expenses for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses"
  on public.expenses for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own expenses" on public.expenses;
create policy "Users can update own expenses"
  on public.expenses for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses"
  on public.expenses for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.expenses to authenticated;

-- 3. Incomes by Month
create table if not exists public.incomes (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.incomes enable row level security;

drop policy if exists "Users can manage own incomes" on public.incomes;
create policy "Users can manage own incomes"
  on public.incomes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.incomes to authenticated;

-- 4. Budgets by Month
create table if not exists public.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.budgets enable row level security;

drop policy if exists "Users can manage own budgets" on public.budgets;
create policy "Users can manage own budgets"
  on public.budgets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.budgets to authenticated;

-- 5. Recurring Schedules
create table if not exists public.recurring_schedules (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text not null default '',
  day int not null check (day between 1 and 31),
  start_month text not null check (start_month ~ '^[0-9]{4}-[0-9]{2}$'),
  kind text not null check (kind in ('monthly', 'emi')),
  installments int check (installments is null or installments > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_user on public.recurring_schedules(user_id);

alter table public.recurring_schedules enable row level security;

drop policy if exists "Users can manage own recurring schedules" on public.recurring_schedules;
create policy "Users can manage own recurring schedules"
  on public.recurring_schedules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.recurring_schedules to authenticated;

-- 6. Legacy Document Store (Preserved for zero-downtime backward compatibility & fallback)
create table if not exists public.expense_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.expense_tracker_data enable row level security;

drop policy if exists "Users can read their own expense data" on public.expense_tracker_data;
create policy "Users can read their own expense data"
  on public.expense_tracker_data for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expense data" on public.expense_tracker_data;
create policy "Users can insert their own expense data"
  on public.expense_tracker_data for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expense data" on public.expense_tracker_data;
create policy "Users can update their own expense data"
  on public.expense_tracker_data for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.expense_tracker_data to authenticated;

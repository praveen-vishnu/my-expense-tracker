-- ==============================================================================
-- MILESTONE A: ACCOUNTS & PAYMENT METHODS MIGRATION
-- Safe to run in Supabase SQL Editor. Fully idempotent.
-- ==============================================================================

-- 1. Create accounts table
create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (type in ('bank', 'credit_card', 'cash', 'wallet')),
  initial_balance numeric(12, 2) not null default 0,
  credit_limit numeric(12, 2) default null,
  color text default null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_user on public.accounts(user_id);

alter table public.accounts enable row level security;

drop policy if exists "Users can manage own accounts" on public.accounts;
create policy "Users can manage own accounts"
  on public.accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.accounts to authenticated;

-- 2. Add account_id column to expenses if not already present
alter table public.expenses add column if not exists account_id text default null references public.accounts(id) on delete set null;
create index if not exists idx_expenses_user_account on public.expenses(user_id, account_id);

-- 3. Seed starter accounts for existing users who don't have accounts yet
insert into public.accounts (id, user_id, name, type, initial_balance, is_default)
select
  'acc_' || substr(md5(u.id::text || '_bank'), 1, 12),
  u.id,
  'Primary Bank',
  'bank',
  0,
  true
from auth.users u
where not exists (select 1 from public.accounts a where a.user_id = u.id)
on conflict (id) do nothing;

insert into public.accounts (id, user_id, name, type, initial_balance, is_default)
select
  'acc_' || substr(md5(u.id::text || '_cash'), 1, 12),
  u.id,
  'Cash',
  'cash',
  0,
  false
from auth.users u
where not exists (select 1 from public.accounts a where a.user_id = u.id and a.type = 'cash')
on conflict (id) do nothing;

-- Summary verification query
select
  (select count(*) from public.accounts) as total_accounts_count,
  (select count(*) from public.expenses where account_id is not null) as tagged_expenses_count,
  (select count(*) from public.expenses where account_id is null) as untagged_expenses_count;

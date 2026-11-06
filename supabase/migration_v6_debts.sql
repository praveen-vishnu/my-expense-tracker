-- Debt records and payment history for the debt tracker.

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.debts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'loan',
  category text not null default 'Other',
  name text not null check (char_length(trim(name)) > 0),
  lender text not null default '',
  original_amount numeric(14, 2) not null check (original_amount > 0),
  balance numeric(14, 2) not null check (balance >= 0),
  rate numeric(8, 4),
  emi numeric(14, 2),
  next_due date,
  months_remaining integer,
  total_months integer,
  principal_paid numeric(14, 2) not null default 0,
  interest_paid numeric(14, 2) not null default 0,
  limit_amount numeric(14, 2),
  apr numeric(8, 4),
  min_due numeric(14, 2),
  borrower text not null default '',
  monthly_rate numeric(8, 4),
  next_interest_due date,
  loan_taken_date date,
  status text not null default 'active' check (status in ('active', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

create index if not exists idx_debts_user_updated on public.debts(user_id, updated_at);

alter table public.debts enable row level security;
drop policy if exists "Users can manage own debts" on public.debts;
create policy "Users can manage own debts"
  on public.debts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.debts to authenticated;

drop trigger if exists trigger_debts_updated_at on public.debts;
create trigger trigger_debts_updated_at
  before update on public.debts
  for each row execute function public.set_row_updated_at();

create table if not exists public.debt_payments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id text not null references public.debts(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  principal numeric(14, 2) not null default 0 check (principal >= 0),
  interest numeric(14, 2) not null default 0 check (interest >= 0),
  fees numeric(14, 2) not null default 0 check (fees >= 0),
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null,
  check (principal + interest + fees <= amount + 0.01)
);

create index if not exists idx_debt_payments_user_updated on public.debt_payments(user_id, updated_at);
create index if not exists idx_debt_payments_debt_date on public.debt_payments(debt_id, date desc);

alter table public.debt_payments enable row level security;
drop policy if exists "Users can manage own debt payments" on public.debt_payments;
create policy "Users can manage own debt payments"
  on public.debt_payments for all to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.debts d where d.id = debt_payments.debt_id and d.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.debts d where d.id = debt_payments.debt_id and d.user_id = auth.uid())
  );
grant select, insert, update, delete on public.debt_payments to authenticated;

drop trigger if exists trigger_debt_payments_updated_at on public.debt_payments;
create trigger trigger_debt_payments_updated_at
  before update on public.debt_payments
  for each row execute function public.set_row_updated_at();

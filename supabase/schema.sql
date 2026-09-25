create table if not exists public.expense_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.expense_categories enable row level security;

drop policy if exists "Users can read their own expense categories" on public.expense_categories;
create policy "Users can read their own expense categories"
  on public.expense_categories
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expense categories" on public.expense_categories;
create policy "Users can insert their own expense categories"
  on public.expense_categories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expense categories" on public.expense_categories;
create policy "Users can update their own expense categories"
  on public.expense_categories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.expense_categories to authenticated;

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
  ]) as category;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_expense_categories on auth.users;
create trigger on_auth_user_created_seed_expense_categories
  after insert on auth.users
  for each row execute procedure public.seed_expense_categories();

alter table public.expense_tracker_data enable row level security;

drop policy if exists "Users can read their own expense data" on public.expense_tracker_data;
create policy "Users can read their own expense data"
  on public.expense_tracker_data
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expense data" on public.expense_tracker_data;
create policy "Users can insert their own expense data"
  on public.expense_tracker_data
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expense data" on public.expense_tracker_data;
create policy "Users can update their own expense data"
  on public.expense_tracker_data
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

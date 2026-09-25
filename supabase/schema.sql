create table if not exists public.expense_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.expense_tracker_data enable row level security;

create policy "Users can read their own expense data"
  on public.expense_tracker_data
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own expense data"
  on public.expense_tracker_data
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own expense data"
  on public.expense_tracker_data
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

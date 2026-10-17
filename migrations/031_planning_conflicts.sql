create table if not exists public.planner_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  start_date date not null,
  end_date date not null,
  category text not null default 'custom',
  notes text not null default '',
  source text not null default '',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (user_id, source_key)
);
alter table public.planner_conflicts enable row level security;
drop policy if exists planner_conflicts_owner on public.planner_conflicts;
create policy planner_conflicts_owner on public.planner_conflicts
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create index if not exists planner_conflicts_dates_idx
on public.planner_conflicts(user_id, start_date, end_date);

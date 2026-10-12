create table if not exists public.planner_life_map (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{"answers":{},"links":{}}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.planner_life_map enable row level security;
create policy "life_map_owner" on public.planner_life_map for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

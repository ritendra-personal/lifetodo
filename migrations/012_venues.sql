create table if not exists planner_venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table planner_projects add column if not exists venue_id uuid;

alter table planner_projects
  drop constraint if exists planner_projects_venue_id_fkey,
  add constraint planner_projects_venue_id_fkey
  foreign key (venue_id) references planner_venues(id) on delete set null;

alter table planner_venues enable row level security;

create index if not exists planner_venues_user_id_idx on planner_venues(user_id);
create index if not exists planner_venues_sort_order_idx on planner_venues(sort_order);
create index if not exists planner_projects_venue_id_idx on planner_projects(venue_id);

drop policy if exists "planner_venues_all_for_authenticated_user" on planner_venues;

create policy "planner_venues_all_for_authenticated_user"
on planner_venues for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

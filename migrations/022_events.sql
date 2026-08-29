create table if not exists planner_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text not null default '',
  meeting_url text,
  area_id uuid references planner_areas(id) on delete set null,
  project_id uuid references planner_projects(id) on delete set null,
  venue_id uuid references planner_venues(id) on delete set null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_events_user_id_idx on planner_events(user_id);
create index if not exists planner_events_start_at_idx on planner_events(start_at);
create index if not exists planner_events_project_id_idx on planner_events(project_id);
create index if not exists planner_events_area_id_idx on planner_events(area_id);

alter table planner_events enable row level security;

drop policy if exists "planner_events_all_for_authenticated_user" on planner_events;
create policy "planner_events_all_for_authenticated_user"
on planner_events for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
